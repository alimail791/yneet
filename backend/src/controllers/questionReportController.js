const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// POST /api/v1/question-reports — "Report an error" from the app (Practice,
// PYQs, Mistakes). Forwarded to the Raise Academy API, where all question
// reports (website + app) are kept and emailed to the admin
// (www.yneet.in/admin/question-reports). No new table here.
const REASONS = ["wrong_answer", "wrong_explanation", "question_error", "options_error", "other"];

exports.reportQuestion = async (req, res) => {
  const { questionId, reason, note, page } = req.body || {};
  if (!questionId || !REASONS.includes(reason)) return res.status(400).json({ message: "Please pick what is wrong." });
  const base = process.env.RAISE_ACADEMY_API_URL, key = process.env.INTERNAL_SERVICE_KEY;
  if (!base || !key) return res.status(503).json({ message: "Reporting isn't available right now." });
  try {
    const q = await prisma.question.findUnique({ where: { id: String(questionId) }, select: { id: true, questionText: true } });
    if (!q) return res.status(404).json({ message: "Question not found." });
    await axios.post(`${base}/question-reports`, {
      questionId: q.id,
      questionText: String(q.questionText || "").slice(0, 300),
      reason,
      note: String(note || "").slice(0, 1000),
      page: String(page || "").slice(0, 100),
      phone: req.user?.phone || "",
      studentName: req.user?.name || "",
    }, { headers: { "X-Internal-Key": key }, timeout: 15000 });
    res.status(201).json({ message: "Thanks! We'll check this question and fix it." });
  } catch (e) {
    console.warn("Question report failed:", e.response?.status || e.message);
    res.status(502).json({ message: "Couldn't send. Please try again." });
  }
};
