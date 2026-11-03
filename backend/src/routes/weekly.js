// /api/v1/weekly — what students see: Concept Maps and the Brain Teaser.
// Open to every signed-in student (like the Sprint): free weekly content that
// brings them back.
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const W = require("../utils/weekly");
const p = W.prisma;

router.use(protect);
router.use((req, res, next) => W.ensureTables().then(() => next()).catch(next));

const grpOf = (req) => W.groupFor(req.user.profile?.class || "12th");

// Live maps for the student's group, newest first. The newest is "this week's".
router.get("/maps", async (req, res, next) => {
  try {
    const grp = grpOf(req);
    const today = W.istDay();
    const rows = await p.$queryRaw`
      SELECT id, subject, chapter, data->>'title' AS title, publish_on FROM weekly.concept_maps
      WHERE grp = ${grp} AND status = 'approved' AND publish_on <= ${today}
      ORDER BY publish_on DESC, id DESC`;
    res.json({ success: true, group: W.GROUPS[grp].label, maps: rows, latestIsNew: !!rows[0] && W.addDays(rows[0].publish_on, 7) > today });
  } catch (err) { next(err); }
});

router.get("/maps/:id", async (req, res, next) => {
  try {
    const rows = await p.$queryRaw`
      SELECT id, grp, subject, chapter, data, publish_on FROM weekly.concept_maps
      WHERE id = ${Number(req.params.id)} AND status = 'approved' AND publish_on <= ${W.istDay()}`;
    if (!rows[0]) return res.status(404).json({ success: false, message: "Map not found" });
    res.json({ success: true, map: rows[0] });
  } catch (err) { next(err); }
});

// Current teaser + the student's answer; the correct answer only after the reveal.
async function teaserView(t, userId) {
  if (!t) return null;
  const revealAt = W.teaserRevealAt(t.publish_on);
  const revealed = Date.now() >= revealAt;
  const mine = userId ? (await p.$queryRaw`SELECT choice FROM weekly.teaser_answers WHERE teaser_id = ${t.id} AND user_id = ${userId}`)[0] : null;
  const view = {
    id: t.id, publishOn: t.publish_on, revealAt: new Date(revealAt).toISOString(), revealed,
    title: t.data.title, clues: t.data.clues, options: t.data.options, topic: t.data.topic,
    myChoice: mine ? mine.choice : null,
  };
  if (revealed) {
    const s = (await p.$queryRaw`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE choice = ${t.data.answer})::int AS correct
      FROM weekly.teaser_answers WHERE teaser_id = ${t.id}`)[0];
    Object.assign(view, { answer: t.data.answer, explanation: t.data.explanation, players: s.n, correctPct: s.n ? Math.round((s.correct / s.n) * 100) : 0 });
  }
  return view;
}

async function liveTeasers(limit = 2) {
  return p.$queryRaw`SELECT * FROM weekly.teasers WHERE status = 'approved' AND publish_on <= ${W.istDay()} ORDER BY publish_on DESC LIMIT ${limit}`;
}

router.get("/teaser", async (req, res, next) => {
  try {
    const [cur, prev] = await liveTeasers(2);
    res.json({ success: true, current: await teaserView(cur, req.user.id), previous: await teaserView(prev, req.user.id) });
  } catch (err) { next(err); }
});

router.post("/teaser/:id/answer", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const choice = Number(req.body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return res.status(400).json({ success: false, message: "Pick an answer." });
    const t = (await p.$queryRaw`SELECT * FROM weekly.teasers WHERE id = ${id} AND status = 'approved' AND publish_on <= ${W.istDay()}`)[0];
    if (!t) return res.status(404).json({ success: false, message: "Teaser not found" });
    if (Date.now() >= W.teaserRevealAt(t.publish_on)) return res.status(400).json({ success: false, message: "The answer is already out." });
    await p.$executeRaw`INSERT INTO weekly.teaser_answers (teaser_id, user_id, choice) VALUES (${id}, ${req.user.id}, ${choice}) ON CONFLICT DO NOTHING`;
    res.json({ success: true, current: await teaserView(t, req.user.id) });
  } catch (err) { next(err); }
});

// For the public website page (no login): the current teaser, never the answer
// before the reveal.
router.publicTeaser = async (req, res) => {
  try {
    await W.ensureTables();
    const [cur, prev] = await liveTeasers(2);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ success: true, current: await teaserView(cur, null), previous: await teaserView(prev, null) });
  } catch (err) { res.status(500).json({ success: false, message: "Could not load the teaser" }); }
};

module.exports = router;
