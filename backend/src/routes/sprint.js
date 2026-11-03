// /api/v1/sprint — the daily 60-Second Sprint (see utils/sprint.js).
// Open to every signed-in student, with or without a paid plan: it is a
// daily habit and a reason to come back, not paid content.
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const S = require("../utils/sprint");

const HARD_LIMIT_MS = S.LIMIT_MS + 15 * 1000; // after this, a submission counts as "time ran out"

router.use(protect);
router.use((req, res, next) => S.ensureTables().then(() => next()).catch(next));

const ctx = (req) => {
  const cls = req.user.profile?.class || "12th";
  const grp = S.groupFor(cls);
  return { userId: req.user.id, grp, day: S.istDay(), label: S.GROUPS[grp].label };
};

async function resultPayload(c, play) {
  const qs = await S.questionsFor(c.day, c.grp);
  const answers = Array.isArray(play.answers) ? play.answers : [];
  const [{ rank, players }, streak] = await Promise.all([S.rankOf(c.day, c.grp, play.score, play.time_ms), S.streakOf(c.userId)]);
  return {
    played: true, day: c.day, group: c.label,
    score: play.score, timeMs: play.time_ms, answered: answers.filter((a) => a !== null && a !== undefined).length,
    rank, players, streak,
    review: qs.map((q, i) => ({ ...S.publicQ(q), answer: q.answer, explanation: q.explanation, yours: answers[i] ?? null })),
  };
}

// Home card: has this student played today? (Does not start the clock.)
router.get("/status", async (req, res, next) => {
  try {
    const c = ctx(req);
    const play = await S.getPlay(c.userId, c.day);
    if (play?.finished_at) {
      const [{ rank, players }, streak] = await Promise.all([S.rankOf(c.day, c.grp, play.score, play.time_ms), S.streakOf(c.userId)]);
      return res.json({ success: true, played: true, group: c.label, score: play.score, timeMs: play.time_ms, rank, players, streak });
    }
    const [{ players }, streak] = await Promise.all([S.rankOf(c.day, c.grp, 0, 0), S.streakOf(c.userId)]);
    res.json({ success: true, played: false, group: c.label, players, streak });
  } catch (err) { next(err); }
});

// Start (or resume) today's sprint: returns the questions and the time left.
router.post("/start", async (req, res, next) => {
  try {
    const c = ctx(req);
    let play = await S.getPlay(c.userId, c.day);
    if (play?.finished_at) return res.json({ success: true, ...(await resultPayload(c, play)) });
    const qs = await S.questionsFor(c.day, c.grp);
    if (qs.length < S.COUNT) return res.status(503).json({ success: false, message: "Today's Sprint isn't ready yet. Please try again later." });
    if (!play) {
      await S.prisma.$executeRaw`INSERT INTO sprint.plays (user_id, day, grp) VALUES (${c.userId}, ${c.day}, ${c.grp}) ON CONFLICT DO NOTHING`;
      play = await S.getPlay(c.userId, c.day);
    }
    const elapsed = Date.now() - new Date(play.started_at).getTime();
    if (elapsed > HARD_LIMIT_MS) {
      // Opened earlier and never submitted: the try is used up.
      await S.prisma.$executeRaw`UPDATE sprint.plays SET finished_at = NOW(), score = 0, time_ms = ${S.LIMIT_MS}, answers = '[]'::jsonb
        WHERE user_id = ${c.userId} AND day = ${c.day} AND finished_at IS NULL`;
      return res.json({ success: true, ...(await resultPayload(c, await S.getPlay(c.userId, c.day))) });
    }
    res.json({
      success: true, played: false, day: c.day, group: c.label,
      remainingMs: Math.max(0, S.LIMIT_MS - elapsed),
      questions: qs.map(S.publicQ),
    });
  } catch (err) { next(err); }
});

router.post("/submit", async (req, res, next) => {
  try {
    const c = ctx(req);
    const play = await S.getPlay(c.userId, c.day);
    if (!play) return res.status(400).json({ success: false, message: "Start the Sprint first." });
    if (play.finished_at) return res.json({ success: true, ...(await resultPayload(c, play)) });
    const qs = await S.questionsFor(c.day, c.grp);
    const raw = Array.isArray(req.body.answers) ? req.body.answers.slice(0, S.COUNT) : [];
    const answers = qs.map((_, i) => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] <= 3 ? raw[i] : null));
    const elapsed = Date.now() - new Date(play.started_at).getTime();
    const late = elapsed > HARD_LIMIT_MS;
    const score = late ? 0 : qs.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    const timeMs = Math.min(elapsed, S.LIMIT_MS);
    await S.prisma.$executeRaw`UPDATE sprint.plays SET finished_at = NOW(), score = ${score}, time_ms = ${timeMs}, answers = ${JSON.stringify(answers)}::jsonb
      WHERE user_id = ${c.userId} AND day = ${c.day} AND finished_at IS NULL`;
    res.json({ success: true, late, ...(await resultPayload(c, await S.getPlay(c.userId, c.day))) });
  } catch (err) { next(err); }
});

// Today's top 10 in the student's group, plus where they stand.
router.get("/leaderboard", async (req, res, next) => {
  try {
    const c = ctx(req);
    const rows = await S.leaderboard(c.day, c.grp, 10);
    res.json({
      success: true, group: c.label,
      top: rows.map((r, i) => ({ rank: i + 1, name: S.shortName(r.name), score: r.score, timeMs: r.time_ms, me: r.user_id === c.userId })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
