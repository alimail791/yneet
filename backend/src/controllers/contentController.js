const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/v1/content/flashcards?subject=Biology
exports.getFlashcards = async (req, res) => {
  try {
    const { subject, chapter } = req.query;
    const classLevel = req.user.profile?.class || "12th";
    const where = { classLevel };
    if (subject) where.subject = subject;
    if (chapter) where.chapter = chapter;
    const flashcards = await prisma.flashcard.findMany({ where, orderBy: [{ subject: "asc" }, { chapter: "asc" }] });
    res.json({ success: true, flashcards, classLevel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/content/formulas?subject=Physics
exports.getFormulas = async (req, res) => {
  try {
    const { subject, chapter } = req.query;
    const classLevel = req.user.profile?.class || "12th";
    const where = { classLevel };
    if (subject) where.subject = subject;
    if (chapter) where.chapter = chapter;
    const formulas = await prisma.formula.findMany({ where, orderBy: [{ subject: "asc" }, { chapter: "asc" }] });
    res.json({ success: true, formulas, classLevel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
