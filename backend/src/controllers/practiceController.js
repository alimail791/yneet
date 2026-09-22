const { PrismaClient } = require("@prisma/client");
const { awardXP } = require("../utils/xp");
const prisma = new PrismaClient();

exports.getQuestions = async (req, res) => {
  try {
    const { subject, chapter, isPYQ, isRepeated, page = 1, limit = 20 } = req.query;
    // Every question served is scoped to the logged-in student's own class syllabus.
    const where = { classLevel: req.user.profile?.class || "12th" };
    if (subject) where.subject = subject;
    if (chapter) where.chapter = chapter;
    if (isPYQ === "true") where.isPYQ = true;
    if (isRepeated === "true") where.isRepeated = true;
    const [questions, total] = await Promise.all([
      prisma.question.findMany({ where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit), orderBy: [{ isPYQ: "desc" }, { pyqYear: "desc" }, { subject: "asc" }], select: { id:true,subject:true,chapter:true,topic:true,difficulty:true,questionText:true,optionA:true,optionB:true,optionC:true,optionD:true,correctOpt:true,explanation:true,isPYQ:true,isRepeated:true,pyqYear:true } }),
      prisma.question.count({ where }),
    ]);
    const solvedMap = {};
    if (questions.length) {
      const stats = await prisma.practiceStat.findMany({ where: { userId: req.user.id, questionId: { in: questions.map(q => q.id) } } });
      stats.forEach(s => { solvedMap[s.questionId] = s; });
    }
    res.json({ success: true, questions: questions.map(q => ({ ...q, userStat: solvedMap[q.id] || null })), total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getChapters = async (req, res) => {
  try {
    const { subject } = req.query;
    const classLevel = req.user.profile?.class || "12th";
    const where = subject ? { subject, classLevel } : { classLevel };
    const chapters = await prisma.question.groupBy({ by: ["chapter", "subject"], where, _count: { id: true }, orderBy: { chapter: "asc" } });
    res.json({ success: true, chapters });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const [total, correct] = await Promise.all([
      prisma.practiceStat.count({ where: { userId: req.user.id } }),
      prisma.practiceStat.count({ where: { userId: req.user.id, correct: true } }),
    ]);
    res.json({ success: true, stats: { totalSolved: total, totalCorrect: correct, accuracy: total ? Math.round(correct/total*100) : 0 } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/practice/recommended — pulls from this student's own mistake
// history to find their top 3 most-missed chapters, then serves a focused set
// of questions from those chapters (their actual missed ones first, then
// fresh ones from the same chapters they haven't tried) — instead of making
// them browse the whole bank manually to find where they're actually weak.
exports.getRecommended = async (req, res) => {
  try {
    const classLevel = req.user.profile?.class || "12th";

    const mistakes = await prisma.mistake.findMany({
      where: { userId: req.user.id },
      include: { question: { select: { id: true, chapter: true, subject: true } } },
    });

    if (mistakes.length === 0) {
      return res.json({ success: true, questions: [], weakChapters: [], message: "No mistakes tracked yet — take a mock test or daily quiz first, then check back here." });
    }

    // Aggregate mistake weight (count) per chapter+subject, pick the top 3.
    const chapterWeight = {};
    for (const m of mistakes) {
      const key = `${m.question.subject}|||${m.question.chapter}`;
      chapterWeight[key] = (chapterWeight[key] || 0) + m.count;
    }
    const topChapters = Object.entries(chapterWeight)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => { const [subject, chapter] = key.split("|||"); return { subject, chapter }; });

    const mistakenQuestionIds = mistakes.map((m) => m.question.id);

    const [alreadyCorrect, pool] = await Promise.all([
      prisma.practiceStat.findMany({ where: { userId: req.user.id, correct: true }, select: { questionId: true } }),
      prisma.question.findMany({
        where: { classLevel, OR: topChapters.map((c) => ({ subject: c.subject, chapter: c.chapter })) },
        select: { id:true,subject:true,chapter:true,topic:true,difficulty:true,questionText:true,optionA:true,optionB:true,optionC:true,optionD:true,correctOpt:true,explanation:true,isPYQ:true },
        take: 60,
      }),
    ]);
    const correctIds = new Set(alreadyCorrect.map((s) => s.questionId));
    const mistakenSet = new Set(mistakenQuestionIds);

    const filtered = pool.filter((q) => !correctIds.has(q.id));
    // Actual missed questions surface first, then other fresh ones from the same weak chapters.
    filtered.sort((a, b) => (mistakenSet.has(b.id) ? 1 : 0) - (mistakenSet.has(a.id) ? 1 : 0));

    res.json({ success: true, questions: filtered.slice(0, 15), weakChapters: topChapters });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.markSolved = async (req, res) => {
  try {
    const { questionId, correct } = req.body;
    const stat = await prisma.practiceStat.upsert({
      where: { userId_questionId: { userId: req.user.id, questionId } },
      update: { solved: true, correct: correct ?? false, solvedAt: new Date() },
      create: { userId: req.user.id, questionId, solved: true, correct: correct ?? false },
    });
    if (correct === false) {
      await prisma.mistake.upsert({
        where: { userId_questionId_source: { userId: req.user.id, questionId, source: "practice" } },
        update: { count: { increment: 1 }, lastSeen: new Date() },
        create: { userId: req.user.id, questionId, source: "practice" },
      });
    }
    const totalSolved = await prisma.practiceStat.count({ where: { userId: req.user.id } });
    if (totalSolved % 10 === 0) await awardXP(req.user.id, "practice_10");
    res.json({ success: true, stat });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
