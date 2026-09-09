const { PrismaClient } = require("@prisma/client");
const { awardXP } = require("../utils/xp");
const prisma = new PrismaClient();

// Daily quiz is per (date + class) — every student in the same class sees the same
// set that day (fair comparison), but a 6th grader never sees a 12th grader's quiz.
// New questions are generated fresh every day (the quizDate key includes today's
// date, so yesterday's set never carries over) — and are weighted toward each
// student's own weak subjects and away from their strong ones.
exports.getDailyQuiz = async (req, res) => {
  try {
    const classLevel = req.user.profile?.class || "12th";
    const weakSubjects = req.user.profile?.weakSubjects || [];
    const strongSubjects = req.user.profile?.strongSubjects || [];
    const today = new Date().toISOString().split("T")[0];
    const quizKey = `${today}::${classLevel}`;

    const QUESTION_SELECT = { id: true, subject: true, chapter: true, topic: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOpt: true, explanation: true };

    const existing = await prisma.quizItem.findMany({
      where: { quizDate: quizKey },
      include: { question: { select: QUESTION_SELECT } },
    });
    if (existing.length >= 20) {
      return res.json({ success: true, questions: existing.map(e => e.question), date: today });
    }

    const [bio, phy, chem] = await Promise.all([
      prisma.question.findMany({ where: { subject: "Biology", classLevel }, take: 80, orderBy: { createdAt: "asc" } }),
      prisma.question.findMany({ where: { subject: "Physics", classLevel }, take: 40, orderBy: { createdAt: "asc" } }),
      prisma.question.findMany({ where: { subject: "Chemistry", classLevel }, take: 40, orderBy: { createdAt: "asc" } }),
    ]);
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    // Base NEET-realistic split is 10 Biology : 5 Physics : 5 Chemistry (20 total).
    // Nudge each subject's count up if it's flagged weak, down if flagged strong —
    // reshuffling the saved points across the other two subjects so the total stays 20.
    const base = { Biology: 10, Physics: 5, Chemistry: 5 };
    const isWeak = s => weakSubjects.includes(s);
    const isStrong = s => strongSubjects.includes(s);
    const counts = { ...base };
    let pool = 0;
    for (const subj of ["Biology", "Physics", "Chemistry"]) {
      if (isWeak(subj) && !isStrong(subj)) { counts[subj] += 3; pool -= 3; }
      else if (isStrong(subj) && !isWeak(subj)) { counts[subj] = Math.max(2, counts[subj] - 3); pool += 3; }
    }
    // Distribute any freed-up slots from "strong" subjects into weak ones (or evenly if none are weak).
    const weakList = ["Biology", "Physics", "Chemistry"].filter(s => isWeak(s) && !isStrong(s));
    const spreadTo = weakList.length ? weakList : ["Biology", "Physics", "Chemistry"];
    let i = 0;
    while (pool > 0) { counts[spreadTo[i % spreadTo.length]] += 1; pool--; i++; }

    // Within each subject, prefer chapters the student explicitly marked weak (e.g.
    // "Thermodynamics", "Genetics") when there are enough matching questions available.
    const prioritizeWeakChapters = (arr, subjectWeakChapters) => {
      if (!subjectWeakChapters.length) return shuffle(arr);
      const matched = arr.filter(q => subjectWeakChapters.some(w => q.chapter?.toLowerCase().includes(w.toLowerCase())));
      const rest = arr.filter(q => !matched.includes(q));
      return [...shuffle(matched), ...shuffle(rest)];
    };
    const weakChapterNames = weakSubjects.filter(s => !["Physics", "Chemistry", "Biology"].includes(s));

    const selected = [
      ...prioritizeWeakChapters(bio, weakChapterNames).slice(0, counts.Biology),
      ...prioritizeWeakChapters(phy, weakChapterNames).slice(0, counts.Physics),
      ...prioritizeWeakChapters(chem, weakChapterNames).slice(0, counts.Chemistry),
    ];

    if (!selected.length) {
      return res.json({ success: true, questions: [], date: today, message: "No quiz content yet for your class." });
    }

    await prisma.quizItem.deleteMany({ where: { quizDate: quizKey } });
    await prisma.quizItem.createMany({ data: selected.map(q => ({ quizDate: quizKey, questionId: q.id })), skipDuplicates: true });
    res.json({
      success: true,
      questions: selected.map(q => ({ id: q.id, subject: q.subject, chapter: q.chapter, topic: q.topic, questionText: q.questionText, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctOpt: q.correctOpt, explanation: q.explanation })),
      date: today,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { answers, date } = req.body;
    let correct = 0;
    const results = [];
    for (const a of answers) {
      const q = await prisma.question.findUnique({ where: { id: a.questionId } });
      if (!q) continue;
      const isCorrect = a.selected === q.correctOpt;
      if (isCorrect) correct++;
      else {
        await prisma.mistake.upsert({
          where: { userId_questionId_source: { userId: req.user.id, questionId: a.questionId, source: "quiz" } },
          update: { count: { increment: 1 }, lastSeen: new Date() },
          create: { userId: req.user.id, questionId: a.questionId, source: "quiz" },
        });
      }
      results.push({ questionId: a.questionId, isCorrect, correctOpt: q.correctOpt, explanation: q.explanation });
    }
    const today = date || new Date().toISOString().split("T")[0];
    await prisma.quizResult.create({ data: { userId: req.user.id, date: today, score: correct, total: answers.length } });
    const xp = await awardXP(req.user.id, correct === answers.length ? "quiz_perfect" : "quiz_complete");
    res.json({ success: true, correct, total: answers.length, results, xp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
