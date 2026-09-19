const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const PER_SUBJECT = 10;

// Picks `count` random questions from a subject without needing raw SQL:
// fetch just the ids (cheap), shuffle in JS, then fetch the full rows for
// the chosen ones. Fine at this question-bank size; would need a smarter
// approach (e.g. a raw `ORDER BY RANDOM()` query) if the bank grows huge.
const randomQuestions = async (subject, count) => {
  const ids = await prisma.question.findMany({ where: { subject }, select: { id: true } });
  const chosen = ids.sort(() => Math.random() - 0.5).slice(0, count).map((q) => q.id);
  if (chosen.length === 0) return [];
  const rows = await prisma.question.findMany({
    where: { id: { in: chosen } },
    select: {
      id: true, subject: true, chapter: true, topic: true, questionText: true,
      optionA: true, optionB: true, optionC: true, optionD: true,
      correctOpt: true, explanation: true,
    },
  });
  // findMany with `id: { in }` doesn't preserve the shuffled order — re-sort
  // to match the random order we picked, otherwise it comes back id-sorted.
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  return chosen.map((id) => byId[id]).filter(Boolean);
};

// GET /api/v1/public/sample-quiz — no login required. Powers the free
// 30-question (10 per subject) taster quiz on Raise Academy's landing page,
// meant to hook visitors into registering for full access. Answers and
// explanations are included directly since this is a low-stakes marketing
// freebie, not a proctored exam.
exports.getSampleQuiz = async (req, res) => {
  try {
    const bySubject = await Promise.all(SUBJECTS.map((s) => randomQuestions(s, PER_SUBJECT)));
    const questions = { Physics: bySubject[0], Chemistry: bySubject[1], Biology: bySubject[2] };
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
