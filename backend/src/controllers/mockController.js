const { PrismaClient } = require("@prisma/client");
const { awardXP } = require("../utils/xp");
const prisma = new PrismaClient();

exports.listTests = async (req, res) => {
  try {
    const classLevel = req.user.profile?.class || "12th";
    const tests = await prisma.mockTest.findMany({
      where: { isActive: true, classLevel }, orderBy: { createdAt: "asc" },
      include: { _count: { select: { questions: true } }, attempts: { where: { userId: req.user.id }, orderBy: { startedAt: "desc" }, take: 1 } },
    });
    res.json({ success: true, tests: tests.map(t => ({ ...t, lastAttempt: t.attempts[0] || null })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.startTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await prisma.mockTest.findUnique({
      where: { id: testId },
      include: { questions: { select: { id:true,subject:true,chapter:true,topic:true,difficulty:true,questionText:true,optionA:true,optionB:true,optionC:true,optionD:true,isPYQ:true,isRepeated:true,pyqYear:true } } },
    });
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    const classLevel = req.user.profile?.class || "12th";
    if (test.classLevel !== classLevel) {
      return res.status(403).json({ success: false, message: "This mock test isn't part of your class's syllabus" });
    }
    let attempt = await prisma.attempt.findFirst({ where: { userId: req.user.id, mockTestId: testId, status: "in_progress" }, include: { responses: true } });
    if (!attempt) attempt = await prisma.attempt.create({ data: { userId: req.user.id, mockTestId: testId, totalMarks: test.totalMarks }, include: { responses: true } });
    const questions = [...test.questions].sort(() => Math.random() - 0.5);
    res.json({ success: true, attempt, questions, test: { id:test.id, title:test.title, durationMin:test.durationMin, totalMarks:test.totalMarks, totalQs:test.totalQs, type:test.type, subject:test.subject } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.saveResponse = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selected, isMarked, timeSec } = req.body;
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    const isCorrect = (selected !== null && selected !== undefined) ? selected === question.correctOpt : false;
    const response = await prisma.attemptResponse.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { selected, isCorrect, isMarked: isMarked ?? false, timeSec: timeSec ?? 0 },
      create: { attemptId, questionId, selected, isCorrect, isMarked: isMarked ?? false, timeSec: timeSec ?? 0 },
    });
    res.json({ success: true, response });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { responses: { include: { question: true } } } });
    if (!attempt || attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden" });
    let score = 0, phy = 0, chem = 0, bio = 0;
    for (const r of attempt.responses) {
      if (r.selected === null || r.selected === undefined) continue;
      const pts = r.isCorrect ? 4 : -1;
      score += pts;
      if (r.question.subject === "Physics") phy += pts;
      else if (r.question.subject === "Chemistry") chem += pts;
      else bio += pts;
      if (!r.isCorrect) {
        await prisma.mistake.upsert({
          where: { userId_questionId_source: { userId: req.user.id, questionId: r.questionId, source: "mock" } },
          update: { count: { increment: 1 }, lastSeen: new Date() },
          create: { userId: req.user.id, questionId: r.questionId, source: "mock" },
        });
      }
    }
    const answered = attempt.responses.filter(r => r.selected !== null && r.selected !== undefined).length;
    const correct = attempt.responses.filter(r => r.isCorrect).length;
    const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
    const updated = await prisma.attempt.update({ where: { id: attemptId }, data: { status: "submitted", score, accuracy, physicsScore: phy, chemScore: chem, bioScore: bio, timeTaken: req.body.timeTaken || 0, submittedAt: new Date() } });
    if (score > (req.user.profile?.currentScore || 0)) {
      await prisma.profile.upsert({
        where: { userId: req.user.id },
        update: { currentScore: score },
        create: { userId: req.user.id, class: "12th", currentScore: score, targetScore: 650, examYear: 2026, studyHoursPerDay: 6, weakSubjects: [], strongSubjects: [] },
      });
    }
    await awardXP(req.user.id, "mock_complete");
    res.json({ success: true, result: { ...updated, accuracy, correct, answered } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAnalysis = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { responses: { include: { question: true } }, mockTest: { select: { title:true,totalMarks:true,totalQs:true } } },
    });
    if (!attempt || attempt.userId !== req.user.id) return res.status(404).json({ success: false, message: "Not found" });
    const chapterMap = {};
    attempt.responses.forEach(r => {
      const key = `${r.question.subject}::${r.question.chapter}`;
      if (!chapterMap[key]) chapterMap[key] = { subject:r.question.subject, chapter:r.question.chapter, correct:0, total:0 };
      chapterMap[key].total++;
      if (r.isCorrect) chapterMap[key].correct++;
    });
    const chapterAnalysis = Object.values(chapterMap).map(c => ({ ...c, accuracy: Math.round((c.correct/c.total)*100) })).sort((a,b) => a.accuracy - b.accuracy);
    res.json({ success: true, attempt, chapterAnalysis });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
