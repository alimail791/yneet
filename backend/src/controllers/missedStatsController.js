// Public "most-missed NEET chapters and questions" stats for
// www.yneet.in/neet-most-missed-chapters — YNeet's own data that no other NEET
// site has, so AI search tools (ChatGPT, Perplexity, Google AI answers) have a
// reason to quote it.
//
// Only totals leave this file: answer counts and accuracy per chapter and per
// question. No user ids, names or per-student data.
//
// Sources: every answered question in a submitted mock test (skipped
// questions don't count) plus every chapter-practice answer. Classes 11, 12
// and Dropper only (the NEET syllabus).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { practiceData, _internal } = require("./practicePagesController");
const { canonical } = _internal;

const NEET_CLASSES = ["11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const MIN_CHAPTER_ANSWERS = 30; // fewer answers than this → accuracy too noisy to publish
const MIN_QUESTION_ANSWERS = 10;
const MIN_TOTAL_ANSWERS = 300; // below this the page says "collecting data" instead of ranking
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache = null;

async function build() {
  const [mock, practice, students] = await Promise.all([
    prisma.$queryRaw`
      SELECT r."questionId" AS id, COUNT(*)::int AS n, SUM(CASE WHEN r."isCorrect" THEN 1 ELSE 0 END)::int AS c
      FROM attempt_responses r JOIN attempts a ON a.id = r."attemptId"
      WHERE a.status = 'submitted' AND r.selected IS NOT NULL
      GROUP BY r."questionId"`,
    prisma.$queryRaw`
      SELECT "questionId" AS id, COUNT(*)::int AS n, SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS c
      FROM practice_stats WHERE solved
      GROUP BY "questionId"`,
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT uid)::int AS n FROM (
        SELECT a."userId" AS uid FROM attempt_responses r
          JOIN attempts a ON a.id = r."attemptId" JOIN questions q ON q.id = r."questionId"
          WHERE a.status = 'submitted' AND r.selected IS NOT NULL AND q."classLevel" IN ('11th', '12th', 'Dropper')
        UNION
        SELECT p."userId" FROM practice_stats p JOIN questions q ON q.id = p."questionId"
          WHERE p.solved AND q."classLevel" IN ('11th', '12th', 'Dropper')
      ) s`,
  ]);

  // Per-question totals from both sources.
  const perQ = new Map();
  for (const row of [...mock, ...practice]) {
    const t = perQ.get(row.id) || { n: 0, c: 0 };
    t.n += Number(row.n); t.c += Number(row.c);
    perQ.set(row.id, t);
  }

  const questions = perQ.size
    ? await prisma.question.findMany({
        where: { id: { in: [...perQ.keys()] }, classLevel: { in: NEET_CLASSES }, subject: { in: SUBJECTS } },
        select: { id: true, subject: true, chapter: true },
      })
    : [];

  // Map each question to its website chapter page (same merging rules as /neet-practice).
  const { chapters, questionById } = await practiceData();
  const chapterByKey = new Map(chapters.map((c) => [`${c.subject}|${canonical(c.subject, c.chapter)?.key}`, c]));
  const perChapter = new Map();
  let totalAnswers = 0;
  let totalCorrect = 0;
  for (const q of questions) {
    const canon = q.chapter && canonical(q.subject, q.chapter.trim());
    const ch = canon && chapterByKey.get(`${q.subject}|${canon.key}`);
    if (!ch) continue;
    const t = perQ.get(q.id);
    totalAnswers += t.n; totalCorrect += t.c;
    const agg = perChapter.get(ch.slug) || { slug: ch.slug, subject: ch.subject, chapter: ch.chapter, answers: 0, correct: 0, expectedQs: ch.weightage?.expectedQs ?? null };
    agg.answers += t.n; agg.correct += t.c;
    perChapter.set(ch.slug, agg);
  }

  const pct = (c, n) => Math.round((c / n) * 1000) / 10;
  const ranked = [...perChapter.values()]
    .filter((c) => c.answers >= MIN_CHAPTER_ANSWERS)
    .map(({ correct, ...c }) => ({ ...c, accuracy: pct(correct, c.answers) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answers - a.answers);

  const bySubject = Object.fromEntries(SUBJECTS.map((s) => [s, ranked.filter((c) => c.subject === s).slice(0, 10)]));
  const subjectAccuracy = Object.fromEntries(SUBJECTS.map((s) => {
    const list = [...perChapter.values()].filter((c) => c.subject === s);
    const n = list.reduce((x, c) => x + c.answers, 0);
    return [s, n ? { answers: n, accuracy: pct(list.reduce((x, c) => x + c.correct, 0), n) } : null];
  }));

  // Most-missed single questions: only ones with a public question page, so
  // the website can link to the full question, answer and explanation.
  const missedQuestions = [...perQ.entries()]
    .filter(([id, t]) => t.n >= MIN_QUESTION_ANSWERS && questionById.has(id))
    .map(([id, t]) => {
      const p = questionById.get(id);
      return { slug: p.slug, subject: p.subject, chapter: p.chapter, chapterSlug: p.chapterSlug, question: p.question.slice(0, 160), pyqYear: p.pyqYear, answers: t.n, accuracy: pct(t.c, t.n) };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.answers - a.answers)
    .slice(0, 15);

  return {
    at: Date.now(),
    body: {
      success: true,
      ready: totalAnswers >= MIN_TOTAL_ANSWERS && ranked.length >= 3,
      updatedAt: new Date().toISOString().slice(0, 10),
      totals: { answers: totalAnswers, students: Number(students[0]?.n || 0), accuracy: totalAnswers ? pct(totalCorrect, totalAnswers) : null, chapters: ranked.length },
      minChapterAnswers: MIN_CHAPTER_ANSWERS,
      subjectAccuracy,
      hardestChapters: ranked.slice(0, 15),
      bySubject,
      missedQuestions,
    },
  };
}

// GET /api/v1/public/missed-stats
exports.missedStats = async (req, res) => {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = await build();
    res.set("Cache-Control", "public, max-age=3600");
    res.json(cache.body);
  } catch (err) {
    console.error("missed-stats error:", err);
    res.status(500).json({ success: false, message: "Could not load the stats" });
  }
};
