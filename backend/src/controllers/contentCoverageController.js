const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/v1/admin/content-coverage
// Returns per (classLevel, subject, chapter) counts for questions, flashcards
// and formulas, so the Bulk Chapter Generator can show exactly which chapters
// are thin or missing content entirely, instead of the admin guessing.
exports.getContentCoverage = async (req, res) => {
  try {
    const [questions, flashcards, formulas] = await Promise.all([
      prisma.question.groupBy({
        by: ["classLevel", "subject", "chapter"],
        _count: { _all: true },
      }),
      prisma.flashcard.groupBy({
        by: ["classLevel", "subject", "chapter"],
        _count: { _all: true },
      }),
      prisma.formula.groupBy({
        by: ["classLevel", "subject", "chapter"],
        _count: { _all: true },
      }),
    ]);

    const key = (r) => `${r.classLevel}||${r.subject}||${r.chapter}`;
    const counts = {};
    const apply = (rows, field) => {
      for (const r of rows) {
        const k = key(r);
        if (!counts[k]) {
          counts[k] = {
            classLevel: r.classLevel,
            subject: r.subject,
            chapter: r.chapter,
            question: 0,
            flashcard: 0,
            formula: 0,
          };
        }
        counts[k][field] = r._count._all;
      }
    };
    apply(questions, "question");
    apply(flashcards, "flashcard");
    apply(formulas, "formula");

    res.json({ success: true, coverage: Object.values(counts) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
