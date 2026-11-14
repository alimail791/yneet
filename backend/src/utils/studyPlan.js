// Study guidance built from a student's own answers. Rule-based (no AI call):
// fast, free, and every suggestion can be traced back to a number we show.
//
//  - analyseAttempt(): time analysis + "what to do next" plan after a mock test
//  - todayPlan():      the dashboard's "Today" card

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SUBJECTS = ["Physics", "Chemistry", "Biology"];
// Share of the average time per question each subject usually needs in NEET:
// Physics has calculations, Biology is mostly recall. For a 180-question,
// 180-minute paper this gives about Physics 81 s, Chemistry 60 s, Biology 45 s.
const PACE_FACTOR = { Physics: 1.35, Chemistry: 1.0, Biology: 0.75 };
const QUICK_GUESS_SEC = 15;

// Biology questions may be tagged Botany or Zoology.
const subjectGroup = (s) => (s === "Botany" || s === "Zoology" ? "Biology" : s);
const isAnswered = (r) => r.selected !== null && r.selected !== undefined;
const practiceLink = (subject, chapter) => `/practice?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`;

function chapterStats(responses) {
  const map = {};
  for (const r of responses) {
    if (!isAnswered(r) || !r.question) continue;
    const key = `${r.question.subject}::${r.question.chapter}`;
    const c = (map[key] ||= { subject: r.question.subject, chapter: r.question.chapter, correct: 0, wrong: 0, total: 0 });
    c.total++;
    if (r.isCorrect) c.correct++; else c.wrong++;
  }
  return Object.values(map).map((c) => ({ ...c, accuracy: Math.round((c.correct / c.total) * 100) }));
}

// ---------------------------------------------------------------- after a test
function analyseAttempt(attempt, test) {
  const responses = attempt.responses || [];
  const answered = responses.filter(isAnswered);
  const wrong = answered.filter((r) => !r.isCorrect);
  const totalQs = test?.totalQs || responses.length;
  const unattempted = Math.max(0, totalQs - answered.length);
  const durationSec = (test?.durationMin || 180) * 60;
  const basePace = totalQs ? durationSec / totalQs : 60;
  const timed = responses.some((r) => r.timeSec > 0);

  // ---- time analysis (only for attempts taken after per-question timing began)
  let time = null;
  if (timed) {
    const bySubject = SUBJECTS.map((s) => {
      const rs = answered.filter((r) => subjectGroup(r.question?.subject) === s);
      if (!rs.length) return null;
      const secs = rs.reduce((a, r) => a + (r.timeSec || 0), 0);
      const correctSecs = rs.filter((r) => r.isCorrect).reduce((a, r) => a + (r.timeSec || 0), 0);
      const isSingleSubject = test?.subject && subjectGroup(test.subject) === s;
      const target = Math.round(isSingleSubject ? basePace : basePace * PACE_FACTOR[s]);
      return { subject: s, answered: rs.length, totalSec: secs, avgSec: Math.round(secs / rs.length), targetSec: target, wastedSec: secs - correctSecs };
    }).filter(Boolean);
    const slowest = [...answered].sort((a, b) => b.timeSec - a.timeSec).slice(0, 5).map((r) => ({
      questionId: r.questionId, subject: r.question?.subject, chapter: r.question?.chapter, timeSec: r.timeSec, isCorrect: r.isCorrect,
      text: (r.question?.questionText || "").slice(0, 120),
    }));
    const quickGuesses = answered.filter((r) => r.timeSec > 0 && r.timeSec < QUICK_GUESS_SEC);
    time = {
      bySubject,
      slowest,
      wrongSec: wrong.reduce((a, r) => a + (r.timeSec || 0), 0),
      quickGuesses: { total: quickGuesses.length, wrong: quickGuesses.filter((r) => !r.isCorrect).length },
    };
  }

  // ---- plan: at most 4 steps, most useful first
  const plan = [];
  const chapters = chapterStats(responses)
    .filter((c) => c.total >= 2 && c.accuracy < 60)
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy);
  for (const c of chapters.slice(0, 2)) {
    plan.push({
      kind: "chapter",
      title: `Revise ${c.chapter}`,
      detail: `${c.correct} of ${c.total} correct in this test. Getting the ${c.wrong} wrong one${c.wrong === 1 ? "" : "s"} right would add ${c.wrong * 5} marks. Read the NCERT section, then practise 30 questions.`,
      action: { label: "Practise this chapter", to: practiceLink(c.subject, c.chapter) },
    });
  }

  const negMarks = wrong.length;
  if (time && time.quickGuesses.wrong >= 3) {
    plan.push({
      kind: "guessing",
      title: "Stop quick guesses",
      detail: `${time.quickGuesses.wrong} of the ${time.quickGuesses.total} answers you gave in under ${QUICK_GUESS_SEC} seconds were wrong (−${time.quickGuesses.wrong} marks). Answer only when you can rule out at least two options; otherwise leave it.`,
      action: null,
    });
  } else if (negMarks >= 10 && answered.length && negMarks / answered.length > 0.35) {
    plan.push({
      kind: "negative",
      title: "Cut negative marking",
      detail: `Wrong answers cost you ${negMarks} marks. More than a third of your answers were wrong: skip questions you can't narrow down to two options.`,
      action: null,
    });
  }

  if (time) {
    const slow = time.bySubject
      .filter((s) => s.answered >= 5 && s.avgSec > s.targetSec * 1.3)
      .sort((a, b) => b.avgSec / b.targetSec - a.avgSec / a.targetSec)[0];
    if (slow) {
      plan.push({
        kind: "speed",
        title: `Speed up in ${slow.subject}`,
        detail: `You took ${slow.avgSec} s per ${slow.subject} question on average; aim for about ${slow.targetSec} s. Do a timed ${slow.subject} test and move on from any question after 2 minutes.`,
        action: { label: `Take a ${slow.subject} test`, to: `/mock?filter=${{ Physics: "phy", Chemistry: "chem", Biology: "bio" }[slow.subject]}` },
      });
    }
  }

  const unusedMin = Math.round((durationSec - (attempt.timeTaken || 0)) / 60);
  if (unattempted >= Math.max(5, totalQs * 0.15) && unusedMin >= 10) {
    plan.push({
      kind: "unused",
      title: "Use all your time",
      detail: `You left ${unattempted} questions unanswered with ${unusedMin} minutes still on the clock. Use the last 15 minutes to revisit marked and skipped questions.`,
      action: null,
    });
  }

  if (wrong.length) {
    plan.push({
      kind: "mistakes",
      title: "Go through your mistakes",
      detail: `Read the explanation for each of the ${wrong.length} questions you got wrong. They're saved to your mistake notebook for revision.`,
      action: { label: "Open mistakes", to: "/mistakes?source=mock" },
    });
  }

  return { time, plan: plan.slice(0, 4), unattempted };
}

// ------------------------------------------------------------ dashboard today
const DAILY_TARGET = { "6th": 20, "7th": 20, "8th": 20, "9th": 30, "10th": 30, "11th": 60, "12th": 60, Dropper: 80 };

function startOfTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000);
}

async function todayPlan(user) {
  const uid = user.id;
  const classLevel = user.profile?.class || "12th";
  const since = startOfTodayIST();
  const d30 = new Date(Date.now() - 30 * 86400000);

  const [inProgress, recentAttempts, practiceToday, recentPractice, tests, mistakes] = await Promise.all([
    prisma.attempt.findFirst({ where: { userId: uid, status: "in_progress" }, orderBy: { startedAt: "desc" }, include: { mockTest: { select: { title: true, durationMin: true } } } }),
    prisma.attempt.findMany({ where: { userId: uid, status: "submitted" }, orderBy: { submittedAt: "desc" }, take: 5, select: { id: true, mockTestId: true, score: true, totalMarks: true, submittedAt: true, mockTest: { select: { title: true } } } }),
    prisma.practiceStat.count({ where: { userId: uid, solvedAt: { gte: since } } }),
    prisma.practiceStat.findMany({ where: { userId: uid, solvedAt: { gte: d30 } }, select: { correct: true, question: { select: { subject: true, chapter: true } } }, take: 1500 }),
    prisma.mockTest.findMany({ where: { isActive: true, classLevel }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, type: true, subject: true, durationMin: true, totalQs: true } }),
    prisma.mistake.count({ where: { userId: uid } }),
  ]);

  // Weak chapters: mock answers from the last 5 tests + 30 days of practice.
  const responses = recentAttempts.length
    ? await prisma.attemptResponse.findMany({ where: { attemptId: { in: recentAttempts.map((a) => a.id) } }, select: { selected: true, isCorrect: true, question: { select: { subject: true, chapter: true } } } })
    : [];
  const asResponses = recentPractice.map((p) => ({ selected: 1, isCorrect: p.correct, question: p.question }));
  const weak = chapterStats([...responses, ...asResponses])
    .filter((c) => c.total >= 3 && c.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, 3)
    .map((c) => ({ ...c, to: practiceLink(c.subject, c.chapter) }));

  // Mock answers count toward today's questions too.
  const todaysAttemptIds = recentAttempts.filter((a) => a.submittedAt >= since).map((a) => a.id);
  const mockToday = todaysAttemptIds.length
    ? await prisma.attemptResponse.count({ where: { attemptId: { in: todaysAttemptIds }, selected: { not: null } } })
    : 0;

  // Next test: one they haven't finished, preferring their weakest subject.
  const done = new Set((await prisma.attempt.findMany({ where: { userId: uid, status: "submitted" }, select: { mockTestId: true }, distinct: ["mockTestId"] })).map((a) => a.mockTestId));
  const fresh = tests.filter((t) => !done.has(t.id) && t.type !== "daily");
  const weakSubject = weak[0]?.subject;
  const nextTest = (weakSubject && fresh.find((t) => t.type === "subject" && subjectGroup(t.subject) === subjectGroup(weakSubject))) || fresh.find((t) => t.type === "full") || fresh[0] || null;

  const target = DAILY_TARGET[classLevel] || 60;
  const doneToday = practiceToday + mockToday;

  let resume = null;
  if (inProgress) {
    const left = Math.floor((new Date(inProgress.startedAt).getTime() + (inProgress.mockTest?.durationMin || 200) * 60000 - Date.now()) / 1000);
    if (left > 0) resume = { attemptId: inProgress.id, title: inProgress.mockTest?.title, secsLeft: left };
  }

  // The one big button: the single most useful thing to do right now.
  let primary;
  if (resume) primary = { label: "Continue my test", kind: "resume", attemptId: resume.attemptId };
  else if (doneToday < target && weak[0]) primary = { label: `Practise ${weak[0].chapter}`, kind: "link", to: weak[0].to };
  else if (nextTest) primary = { label: `Take ${nextTest.title}`, kind: "test", testId: nextTest.id };
  else primary = { label: "Practise questions", kind: "link", to: "/practice" };

  const last = recentAttempts[0];
  return {
    target,
    doneToday,
    resume,
    lastResult: last ? { attemptId: last.id, title: last.mockTest?.title, score: last.score, totalMarks: last.totalMarks, submittedAt: last.submittedAt } : null,
    weakChapters: weak,
    nextTest,
    mistakes,
    primary,
  };
}

module.exports = { analyseAttempt, todayPlan, chapterStats };
