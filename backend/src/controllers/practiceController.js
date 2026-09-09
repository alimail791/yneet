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
