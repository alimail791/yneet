// 60-Second Sprint: 5 quick questions a day, 60 seconds, one ranked try per day.
//
// - Everyone in the same group gets the same 5 questions on the same IST day,
//   so the daily rank is fair. Groups: NEET (11th, 12th, Dropper), Foundation
//   (9th, 10th) and Junior (6th–8th).
// - Questions are picked from the existing bank: short ones only (it's a speed
//   round), at most 2 per subject, in an order seeded by the date.
// - The timer runs on the server: /start records the start time, /submit uses
//   the server's clock, so reloading or a slow phone can't buy extra seconds.
// - Plays are stored in their own Postgres schema, "sprint", created here with
//   plain SQL. Not in prisma/schema.prisma, so `prisma db push` never touches it.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const IST_MS = 5.5 * 60 * 60 * 1000;
const LIMIT_MS = 60 * 1000;
const GRACE_MS = 5 * 1000; // network delay on the final tap
const COUNT = 5;

const GROUPS = {
  neet: { label: "NEET", classes: ["11th", "12th", "Dropper"] },
  foundation: { label: "Class 9–10", classes: ["9th", "10th"] },
  junior: { label: "Class 6–8", classes: ["6th", "7th", "8th"] },
};
const groupFor = (cls) => {
  for (const [key, g] of Object.entries(GROUPS)) if (g.classes.includes(cls)) return key;
  return "neet";
};
const istDay = (t = Date.now()) => new Date(t + IST_MS).toISOString().slice(0, 10);

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS sprint`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS sprint.plays (
        user_id     TEXT NOT NULL,
        day         TEXT NOT NULL,
        grp         TEXT NOT NULL,
        started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        score       INT,
        time_ms     INT,
        answers     JSONB,
        PRIMARY KEY (user_id, day)
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS plays_board_idx ON sprint.plays (day, grp, score DESC, time_ms ASC)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Today's 5 questions for a group (with answers — strip them before sending to a player).
const qCache = new Map(); // `${day}|${grp}` → questions
async function questionsFor(day, grp) {
  const key = `${day}|${grp}`;
  if (qCache.has(key)) return qCache.get(key);
  const classes = GROUPS[grp].classes;
  const rows = await prisma.$queryRaw`
    SELECT id, subject, chapter, "questionText", "optionA", "optionB", "optionC", "optionD", "correctOpt", explanation
    FROM questions
    WHERE "classLevel" = ANY(${classes})
      AND "correctOpt" BETWEEN 0 AND 3
      AND length("questionText") BETWEEN 15 AND 150
      AND GREATEST(length("optionA"), length("optionB"), length("optionC"), length("optionD")) <= 45
      AND LEAST(length("optionA"), length("optionB"), length("optionC"), length("optionD")) >= 1
      AND "questionText" NOT ILIKE '%assertion%'
      AND "questionText" NOT ILIKE '%match the%'
      AND "questionText" NOT ILIKE '%statement%'
      AND "questionText" NOT ILIKE '%figure%'
      AND "questionText" NOT ILIKE '%diagram%'
      AND "questionText" NOT ILIKE '%given below%'
    ORDER BY md5(id || ${day})
    LIMIT 40`;
  const perSubject = {};
  const picked = [];
  for (const r of rows) {
    if (picked.length >= COUNT) break;
    if ((perSubject[r.subject] || 0) >= 2) continue;
    perSubject[r.subject] = (perSubject[r.subject] || 0) + 1;
    picked.push({
      id: r.id, subject: r.subject, chapter: r.chapter, text: r.questionText,
      options: [r.optionA, r.optionB, r.optionC, r.optionD],
      answer: r.correctOpt, explanation: r.explanation || "",
    });
  }
  for (const r of rows) { // top up if subjects were too few
    if (picked.length >= COUNT) break;
    if (!picked.some((p) => p.id === r.id)) picked.push({
      id: r.id, subject: r.subject, chapter: r.chapter, text: r.questionText,
      options: [r.optionA, r.optionB, r.optionC, r.optionD], answer: r.correctOpt, explanation: r.explanation || "",
    });
  }
  if (qCache.size > 20) qCache.clear();
  if (picked.length === COUNT) qCache.set(key, picked);
  return picked;
}

const publicQ = (q) => ({ id: q.id, subject: q.subject, chapter: q.chapter, text: q.text, options: q.options });

async function getPlay(userId, day) {
  const rows = await prisma.$queryRaw`SELECT * FROM sprint.plays WHERE user_id = ${userId} AND day = ${day}`;
  return rows[0] || null;
}

async function rankOf(day, grp, score, timeMs) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) FILTER (WHERE score > ${score} OR (score = ${score} AND time_ms < ${timeMs}))::int AS ahead,
           COUNT(*)::int AS players
    FROM sprint.plays WHERE day = ${day} AND grp = ${grp} AND finished_at IS NOT NULL`;
  return { rank: rows[0].ahead + 1, players: rows[0].players };
}

// Consecutive days (ending today, or yesterday if today isn't played yet) with a finished sprint.
async function streakOf(userId) {
  const rows = await prisma.$queryRaw`
    SELECT day FROM sprint.plays WHERE user_id = ${userId} AND finished_at IS NOT NULL ORDER BY day DESC LIMIT 400`;
  const days = new Set(rows.map((r) => r.day));
  let t = Date.now();
  if (!days.has(istDay(t))) t -= 24 * 60 * 60 * 1000;
  let n = 0;
  while (days.has(istDay(t))) { n++; t -= 24 * 60 * 60 * 1000; }
  return n;
}

async function leaderboard(day, grp, limit = 10) {
  return prisma.$queryRaw`
    SELECT p.user_id, p.score, p.time_ms, u.name
    FROM sprint.plays p JOIN users u ON u.id = p.user_id
    WHERE p.day = ${day} AND p.grp = ${grp} AND p.finished_at IS NOT NULL
    ORDER BY p.score DESC, p.time_ms ASC, p.finished_at ASC
    LIMIT ${limit}`;
}

// "Priya Sharma" → "Priya S." — never a full name on a shared board.
const shortName = (name) => {
  const parts = String(name || "Student").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

module.exports = {
  GROUPS, LIMIT_MS, GRACE_MS, COUNT, groupFor, istDay, ensureTables, questionsFor, publicQ,
  getPlay, rankOf, streakOf, leaderboard, shortName, prisma,
};
