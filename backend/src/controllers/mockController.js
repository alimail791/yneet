const { PrismaClient } = require("@prisma/client");
const { awardXP } = require("../utils/xp");
const { analyseAttempt } = require("../utils/studyPlan");
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

// Time allowed after the clock runs out for the last answers and the
// auto-submit to reach the server (slow phones, weak signal).
const GRACE_SEC = 120;

const QUESTION_SELECT = { id:true,subject:true,chapter:true,topic:true,difficulty:true,questionText:true,optionA:true,optionB:true,optionC:true,optionD:true,isPYQ:true,isRepeated:true,pyqYear:true };

// Same shuffled order every time an attempt is opened (resume, refresh,
// another device), so question numbers and the palette don't change mid-test.
function seededOrder(items, seed) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000000) / 1000000; };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const secsLeftFor = (attempt, durationMin) =>
  Math.floor((new Date(attempt.startedAt).getTime() + (durationMin || 200) * 60000 - Date.now()) / 1000);

function attemptPayload(attempt, test) {
  return {
    success: true,
    attempt,
    // Server clock decides the time left, so reloading the page or pressing
    // Continue never resets the timer.
    secsLeft: Math.max(0, secsLeftFor(attempt, test.durationMin)),
    questions: seededOrder(test.questions, attempt.id),
    test: { id:test.id, title:test.title, durationMin:test.durationMin, totalMarks:test.totalMarks, totalQs:test.totalQs, type:test.type, subject:test.subject },
  };
}

exports.startTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await prisma.mockTest.findUnique({
      where: { id: testId },
      include: { questions: { select: QUESTION_SELECT } },
    });
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    const classLevel = req.user.profile?.class || "12th";
    if (test.classLevel !== classLevel) {
      return res.status(403).json({ success: false, message: "This mock test isn't part of your class's syllabus" });
    }
    let attempt = await prisma.attempt.findFirst({ where: { userId: req.user.id, mockTestId: testId, status: "in_progress" }, include: { responses: true } });
    // An unfinished attempt whose time ran out is scored as it stands, and a fresh one starts.
    if (attempt && secsLeftFor(attempt, test.durationMin) < -GRACE_SEC) {
      await finalizeAttempt(attempt.id, req.user, test.durationMin * 60);
      attempt = null;
    }
    if (!attempt) attempt = await prisma.attempt.create({ data: { userId: req.user.id, mockTestId: testId, totalMarks: test.totalMarks }, include: { responses: true } });
    res.json(attemptPayload(attempt, test));
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Reopen an attempt by its id: page refresh, the app being killed, or the
// Continue button. Returns the same order, the saved answers and the real time left.
exports.resumeAttempt = async (req, res) => {
  try {
    const attempt = await prisma.attempt.findUnique({ where: { id: req.params.attemptId }, include: { responses: true } });
    if (!attempt || attempt.userId !== req.user.id) return res.status(404).json({ success: false, message: "Test not found" });
    if (attempt.status !== "in_progress") return res.json({ success: true, submitted: true, attemptId: attempt.id });
    const test = await prisma.mockTest.findUnique({ where: { id: attempt.mockTestId }, include: { questions: { select: QUESTION_SELECT } } });
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });
    if (secsLeftFor(attempt, test.durationMin) < -GRACE_SEC) {
      await finalizeAttempt(attempt.id, req.user, test.durationMin * 60);
      return res.json({ success: true, submitted: true, attemptId: attempt.id });
    }
    res.json(attemptPayload(attempt, test));
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.saveResponse = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selected, isMarked, timeSec } = req.body;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { mockTest: { select: { durationMin: true } } } });
    if (!attempt || attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden" });
    if (attempt.status !== "in_progress") return res.status(409).json({ success: false, code: "submitted", message: "This test has already been submitted" });
    if (secsLeftFor(attempt, attempt.mockTest?.durationMin) < -GRACE_SEC) return res.status(409).json({ success: false, code: "time_up", message: "Time is up for this test" });
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ success: false, message: "Question not found" });
    const sel = (selected === null || selected === undefined) ? null : Number(selected);
    const isCorrect = sel !== null ? sel === question.correctOpt : false;
    const t = Math.max(0, Math.min(24 * 3600, Math.round(Number(timeSec) || 0)));
    const response = await prisma.attemptResponse.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { selected: sel, isCorrect, isMarked: !!isMarked, timeSec: t },
      create: { attemptId, questionId, selected: sel, isCorrect, isMarked: !!isMarked, timeSec: t },
    });
    res.json({ success: true, response: { questionId: response.questionId, selected: response.selected, isMarked: response.isMarked } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Scores an in-progress attempt (used by Submit, and by start/resume when an
// abandoned attempt's time has run out). Runs once: a second call returns null.
async function finalizeAttempt(attemptId, user, timeTaken) {
  const claimed = await prisma.attempt.updateMany({ where: { id: attemptId, status: "in_progress" }, data: { status: "submitting" } });
  if (claimed.count === 0) return null;
  try {
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { responses: { include: { question: true } } } });
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
          where: { userId_questionId_source: { userId: user.id, questionId: r.questionId, source: "mock" } },
          update: { count: { increment: 1 }, lastSeen: new Date() },
          create: { userId: user.id, questionId: r.questionId, source: "mock" },
        });
      }
    }
    const answered = attempt.responses.filter(r => r.selected !== null && r.selected !== undefined).length;
    const correct = attempt.responses.filter(r => r.isCorrect).length;
    const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
    const updated = await prisma.attempt.update({ where: { id: attemptId }, data: { status: "submitted", score, accuracy, physicsScore: phy, chemScore: chem, bioScore: bio, timeTaken: Math.max(0, Math.round(Number(timeTaken) || 0)), submittedAt: new Date() } });
    if (score > (user.profile?.currentScore || 0)) {
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: { currentScore: score },
        create: { userId: user.id, class: "12th", currentScore: score, targetScore: 650, examYear: 2026, studyHoursPerDay: 6, weakSubjects: [], strongSubjects: [] },
      });
    }
    await awardXP(user.id, "mock_complete");
    return { ...updated, accuracy, correct, answered };
  } catch (err) {
    // Put it back so the student can submit again.
    await prisma.attempt.update({ where: { id: attemptId }, data: { status: "in_progress" } }).catch(() => {});
    throw err;
  }
}

exports.submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden" });
    const result = await finalizeAttempt(attemptId, req.user, req.body.timeTaken);
    // Already submitted (double tap, auto-submit racing the button): not an error.
    if (!result) return res.json({ success: true, alreadySubmitted: true, result: await prisma.attempt.findUnique({ where: { id: attemptId } }) });
    res.json({ success: true, result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAnalysis = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { responses: { include: { question: true } }, mockTest: { select: { title:true,totalMarks:true,totalQs:true,durationMin:true,subject:true,type:true } } },
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
    const { time, plan } = analyseAttempt(attempt, attempt.mockTest);
    res.json({ success: true, attempt, chapterAnalysis, time, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
