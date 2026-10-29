// More public, no-login content for www.yneet.in:
//   • NEET Question of the Day — one question per IST date, the same for everyone, so the
//     WhatsApp channel post, the website page and shares all match.
//   • NEET previous-year papers by year — every PYQ in the bank for a year, with answers.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { practiceData, _internal } = require("./practicePagesController");

const DAY = 24 * 60 * 60 * 1000;
const istDate = (t = Date.now()) => new Date(t + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);

// Rotation: Biology, Physics, Biology, Chemistry — Biology is half the NEET paper.
const PATTERN = ["Biology", "Physics", "Biology", "Chemistry"];
// Deterministic shuffle so consecutive days hop between chapters instead of walking one chapter.
function seeded(list, seed) {
  const x = [...list];
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

async function questionFor(date) {
  const { chapters } = await practiceData();
  // Count days from 1 Oct 2026 so the first rotation cycle starts clean (no repeats until the pool is used up).
  const n = Math.max(0, dayNumber(date) - dayNumber("2026-10-01"));
  const subject = PATTERN[n % PATTERN.length];
  const pool = [];
  for (const c of chapters) if (c.subject === subject) for (const q of c.questions) pool.push({ q, c });
  if (!pool.length) return null;
  // Same order for a whole cycle through the pool; how many times this subject has come up so far picks the slot.
  const turn = Math.floor(n / PATTERN.length) * PATTERN.filter((x) => x === subject).length + PATTERN.slice(0, n % PATTERN.length).filter((x) => x === subject).length;
  const cycle = Math.floor(turn / pool.length);
  const { q, c } = seeded(pool, 7919 * (cycle + 1) + subject.length)[turn % pool.length];
  return {
    date, number: dayNumber(date) - dayNumber("2026-10-29") + 1, subject, chapter: c.chapter, slug: c.slug, // number #1 = launch day
    question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, pyqYear: q.pyqYear,
  };
}

// GET /api/v1/public/qotd → { today, yesterday }
exports.questionOfTheDay = async (req, res) => {
  try {
    const today = istDate();
    const yesterday = istDate(Date.now() - DAY);
    const [t, y] = await Promise.all([questionFor(today), questionFor(yesterday)]);
    res.set("Cache-Control", "public, max-age=600");
    res.json({ success: true, today: t, yesterday: y });
  } catch (err) {
    console.error("qotd error:", err);
    res.status(500).json({ success: false, message: "Could not load the question" });
  }
};

// ── Previous-year papers ──
const NEET_CLASSES = ["11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const MIN_PER_YEAR = 20;
let papersCache = null;

async function buildPapers() {
  const rows = await prisma.question.findMany({
    where: { isPYQ: true, pyqYear: { not: null }, classLevel: { in: NEET_CLASSES }, subject: { in: SUBJECTS } },
    select: { id: true, subject: true, chapter: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOpt: true, explanation: true, pyqYear: true },
    orderBy: [{ pyqYear: "desc" }, { id: "asc" }],
  });
  const years = new Map();
  for (const q of rows) {
    if (!q.questionText) continue;
    if (!years.has(q.pyqYear)) years.set(q.pyqYear, { year: q.pyqYear, seen: new Set(), bySubject: { Physics: [], Chemistry: [], Biology: [] } });
    const y = years.get(q.pyqYear);
    const k = String(q.questionText).replace(/\s+/g, " ").trim().toLowerCase();
    if (y.seen.has(k)) continue;
    y.seen.add(k);
    const canon = q.chapter ? _internal.canonical(q.subject, q.chapter.trim()) : null;
    y.bySubject[q.subject].push({
      id: q.id, chapter: (canon && canon.name) || q.chapter || "", question: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      answer: q.correctOpt + 1, // 0-based in the bank; the website is 1-based
      explanation: q.explanation,
    });
  }
  const papers = [...years.values()]
    .map((y) => ({ year: y.year, total: SUBJECTS.reduce((n, s) => n + y.bySubject[s].length, 0), counts: Object.fromEntries(SUBJECTS.map((s) => [s, y.bySubject[s].length])), subjects: y.bySubject }))
    .filter((p) => p.total >= MIN_PER_YEAR)
    .sort((a, b) => b.year - a.year);
  return { at: Date.now(), papers };
}
async function papers() {
  if (!papersCache || Date.now() - papersCache.at > 6 * 60 * 60 * 1000) papersCache = await buildPapers();
  return papersCache;
}

// GET /api/v1/public/papers          → years with counts
// GET /api/v1/public/papers?full=1   → every year with its questions (website build)
exports.listPapers = async (req, res) => {
  try {
    const { papers: list } = await papers();
    res.set("Cache-Control", "public, max-age=3600");
    if (req.query.full === "1") return res.json({ success: true, papers: list });
    res.json({ success: true, papers: list.map(({ subjects, ...p }) => p) });
  } catch (err) {
    console.error("papers list error:", err);
    res.status(500).json({ success: false, message: "Could not load papers" });
  }
};

// GET /api/v1/public/papers/:year
exports.getPaper = async (req, res) => {
  try {
    const { papers: list } = await papers();
    const p = list.find((x) => String(x.year) === String(req.params.year));
    if (!p) return res.status(404).json({ success: false, message: "Paper not found" });
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ success: true, paper: p, years: list.map((x) => x.year) });
  } catch (err) {
    console.error("paper error:", err);
    res.status(500).json({ success: false, message: "Could not load paper" });
  }
};

exports._internal = { questionFor, istDate, dayNumber };
