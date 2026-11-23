// Weekly All-India NEET Mock — free for every Class 9–Dropper student, every Sunday.
//
// One MockTest per Sunday, created automatically the first time anyone opens the
// All-India page that week (no admin work). No schema change: it is a normal
// MockTest with type "allindia", classLevel "ALL" (so it never appears in a
// class's regular test list) and the Sunday's date ("YYYY-MM-DD") kept in the
// `subject` field.
//
// Ranked window: the whole Sunday, India time. A student's FIRST attempt started
// inside the window is ranked (score high→low, then less time). Attempts after
// Sunday are allowed as practice but are not ranked.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TYPE = "allindia";
const CLASS_TAG = "ALL";
const POOL = ["11th", "12th", "Dropper"];
// NEET pattern at half length: 90 questions, 90 minutes, +4/−1.
const COUNTS = { Physics: 22, Chemistry: 23, Biology: 45 };
const DURATION_MIN = 90;
const JUNIOR = ["6th", "7th", "8th"];

const IST_MS = 330 * 60000;
const DAY_MS = 864e5;
const istToday = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const dow = (day) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const opensAt = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - IST_MS);
const closesAt = (day) => new Date(opensAt(day).getTime() + DAY_MS);
const prettyDate = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// This week's Sunday: today if it is Sunday, otherwise the coming one.
const thisSunday = () => { const t = istToday(); return addDays(t, (7 - dow(t)) % 7); };
// The latest Sunday that has fully finished (results are final).
const lastFinishedSunday = () => { const t = istToday(); const d = dow(t); return addDays(t, -(d === 0 ? 7 : d)); };

const statusFor = (day) => {
  const now = Date.now();
  if (now < opensAt(day).getTime()) return "upcoming";
  if (now < closesAt(day).getTime()) return "live";
  return "closed";
};

const isAllIndia = (test) => test?.type === TYPE;
const isJuniorClass = (cls) => JUNIOR.includes(cls);

const findTest = (day) => prisma.mockTest.findFirst({ where: { type: TYPE, subject: day } });

// Spread the picks across chapters so one chapter can't dominate the paper.
function pickBalanced(pool, count) {
  const byChapter = new Map();
  for (const q of pool.sort(() => Math.random() - 0.5)) {
    if (!byChapter.has(q.chapter)) byChapter.set(q.chapter, []);
    byChapter.get(q.chapter).push(q);
  }
  const lists = [...byChapter.values()];
  const out = [];
  while (out.length < count && lists.some((l) => l.length)) {
    for (const l of lists) { if (l.length && out.length < count) out.push(l.pop()); }
  }
  return out;
}

let creating = null;
async function ensureTest(day) {
  const existing = await findTest(day);
  if (existing) return existing;
  // One build at a time per server, and re-check so two requests don't make two tests.
  if (!creating) {
    creating = (async () => {
      const again = await findTest(day);
      if (again) return again;
      const picked = [];
      for (const [subject, n] of Object.entries(COUNTS)) {
        const pool = await prisma.question.findMany({ where: { subject, classLevel: { in: POOL } }, select: { id: true, chapter: true } });
        picked.push(...pickBalanced(pool, n));
      }
      if (!picked.length) return null;
      const test = await prisma.mockTest.create({
        data: {
          title: `All-India NEET Mock · ${prettyDate(day)}`,
          type: TYPE, classLevel: CLASS_TAG, subject: day,
          totalQs: picked.length, totalMarks: picked.length * 4, durationMin: DURATION_MIN,
          questions: { connect: picked.map((q) => ({ id: q.id })) },
        },
      });
      console.log(`[allindia] created ${test.title} (${picked.length} questions)`);
      return test;
    })().finally(() => { creating = null; });
  }
  return creating;
}

// Ranked attempts for a Sunday's test: first submitted attempt per student that
// started inside the window. Returns [{ userId, score, timeTaken, accuracy, name, place }].
async function rankedRows(test) {
  const day = test.subject;
  const rows = await prisma.$queryRaw`
    SELECT * FROM (
      SELECT DISTINCT ON (a."userId") a."userId" AS "userId", a.id, a.score, a."timeTaken" AS "timeTaken", a.accuracy, a."startedAt" AS "startedAt",
             u.name, u.place
      FROM attempts a JOIN users u ON u.id = a."userId"
      WHERE a."mockTestId" = ${test.id} AND a.status = 'submitted'
        AND a."startedAt" >= ${opensAt(day)} AND a."startedAt" < ${closesAt(day)}
      ORDER BY a."userId", a."startedAt" ASC
    ) firsts
    ORDER BY score DESC, "timeTaken" ASC, "startedAt" ASC`;
  return rows;
}

// "Priya S." — first name plus initial, never the full name.
const displayName = (name) => {
  const parts = String(name || "Student").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

async function leaderboard(test, userId, topN = 50) {
  const rows = await rankedRows(test);
  const takers = rows.length;
  const top = rows.slice(0, topN).map((r, i) => ({
    rank: i + 1, name: displayName(r.name), place: r.place || "", score: r.score,
    accuracy: Math.round(r.accuracy || 0), minutes: Math.round((r.timeTaken || 0) / 60), me: r.userId === userId,
  }));
  const idx = rows.findIndex((r) => r.userId === userId);
  const me = idx < 0 ? null : {
    rank: idx + 1, score: rows[idx].score, attemptId: rows[idx].id,
    // Share of students you scored above (100 = top).
    percentile: takers > 1 ? Math.round(((takers - 1 - idx) / (takers - 1)) * 1000) / 10 : 100,
  };
  return { takers, top, me, totalMarks: test.totalMarks };
}

// The student's latest attempt on a test (to show Resume / Done on the page).
const findTestAttempts = (mockTestId, userId) =>
  prisma.attempt.findFirst({ where: { mockTestId, userId }, orderBy: { startedAt: "desc" } });

module.exports = {
  prisma, findTestAttempts, rankedRows,
  TYPE, DURATION_MIN, COUNTS, istToday, addDays, dow, opensAt, closesAt, prettyDate,
  thisSunday, lastFinishedSunday, statusFor, isAllIndia, isJuniorClass, findTest, ensureTest, leaderboard,
};
