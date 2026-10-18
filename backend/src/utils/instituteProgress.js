const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Progress numbers an institute sees for its own students (called server-to-server
// from Raise Academy, which decides which student ids an institute may see).
const DAY = 24 * 60 * 60 * 1000;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const pctOf = (a) => pct(a.score, a.totalMarks || 720);
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const isFull = (a) => (a.totalMarks || 720) >= 600;

async function weakChaptersFor(userIds, since) {
  if (!userIds.length) return [];
  // Wrong (attempted, not skipped) answers in submitted tests, grouped by chapter.
  return prisma.$queryRaw`
    SELECT a."userId" AS "userId", q.subject AS subject, q.chapter AS chapter,
           COUNT(*)::int AS wrong
    FROM attempt_responses r
    JOIN attempts a ON a.id = r."attemptId"
    JOIN questions q ON q.id = r."questionId"
    WHERE a."userId" = ANY(${userIds}) AND a.status = 'submitted' AND a."submittedAt" >= ${since}
      AND r."isCorrect" = false AND r.selected IS NOT NULL
    GROUP BY a."userId", q.subject, q.chapter`;
}

// Summary row per student + institute-wide totals.
async function institutesSummary(userIds) {
  const ids = [...new Set((userIds || []).map(String))].slice(0, 1000);
  const now = new Date();
  const d7 = new Date(now - 7 * DAY), d30 = new Date(now - 30 * DAY);

  const [users, attempts, totals, quiz7, practice7, practiceAll, weak] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, streak: { select: { current: true, lastActive: true } }, subscription: { select: { status: true, endDate: true, plan: true } } } }),
    prisma.attempt.findMany({
      where: { userId: { in: ids }, status: "submitted", submittedAt: { gte: d30 } },
      select: { userId: true, score: true, totalMarks: true, accuracy: true, physicsScore: true, chemScore: true, bioScore: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "submitted" }, _count: { _all: true }, _max: { submittedAt: true } }),
    prisma.quizResult.findMany({ where: { userId: { in: ids }, createdAt: { gte: d7 } }, select: { userId: true, createdAt: true } }),
    prisma.practiceStat.findMany({ where: { userId: { in: ids }, solvedAt: { gte: d7 } }, select: { userId: true, solvedAt: true, correct: true } }),
    prisma.practiceStat.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    weakChaptersFor(ids, d30),
  ]);

  const byUser = (rows) => rows.reduce((m, r) => ((m[r.userId] = m[r.userId] || []).push(r), m), {});
  const att = byUser(attempts), q7 = byUser(quiz7), p7 = byUser(practice7), wk = byUser(weak);
  const tot = Object.fromEntries(totals.map((t) => [t.userId, t]));
  const pAll = Object.fromEntries(practiceAll.map((t) => [t.userId, t._count._all]));
  const uMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const students = ids.map((id) => {
    const u = uMap[id];
    if (!u) return { userId: id, joined: false };
    const a30 = att[id] || [];
    const a7 = a30.filter((a) => a.submittedAt >= d7);
    const full = a30.filter(isFull);
    const latest = full[full.length - 1] || null;
    const days7 = new Set([...a7.map((a) => istDay(a.submittedAt)), ...(q7[id] || []).map((q) => istDay(q.createdAt)), ...(p7[id] || []).map((p) => istDay(p.solvedAt))]);
    const lastSeen = [tot[id]?._max?.submittedAt, u.streak?.lastActive].filter(Boolean).sort((x, y) => new Date(y) - new Date(x))[0] || null;
    const weakList = (wk[id] || []).sort((x, y) => y.wrong - x.wrong).slice(0, 3).map((w) => ({ subject: w.subject, chapter: w.chapter, wrong: w.wrong }));
    return {
      userId: id,
      joined: true,
      testsTotal: tot[id]?._count?._all || 0,
      tests7: a7.length,
      tests30: a30.length,
      avgPct30: a30.length ? Math.round(a30.reduce((n, a) => n + pctOf(a), 0) / a30.length) : null,
      accuracy30: a30.length ? Math.round(a30.reduce((n, a) => n + (a.accuracy || 0), 0) / a30.length) : null,
      latestMock: latest && { score: latest.score, physics: latest.physicsScore, chemistry: latest.chemScore, biology: latest.bioScore, date: latest.submittedAt },
      bestMock30: full.length ? Math.max(...full.map((a) => a.score)) : null,
      // first vs last full mock in the window — positive means improving
      mockTrend: full.length >= 2 ? full[full.length - 1].score - full[0].score : null,
      activeDays7: days7.size,
      practice7: (p7[id] || []).length,
      practiceTotal: pAll[id] || 0,
      streak: days7.size ? u.streak?.current || 0 : 0,
      lastActive: lastSeen,
      weakChapters: weakList,
      planActive: u.subscription?.status === "active" && u.subscription?.endDate > now,
    };
  });

  // Institute-wide view
  const joined = students.filter((s) => s.joined);
  const withScores = joined.filter((s) => s.avgPct30 != null);
  const chapterAgg = {};
  weak.forEach((w) => { const k = `${w.chapter}|${w.subject}`; chapterAgg[k] = (chapterAgg[k] || 0) + w.wrong; });
  const summary = {
    students: ids.length,
    joined: joined.length,
    notJoined: ids.length - joined.length,
    active7: joined.filter((s) => s.activeDays7 > 0).length,
    inactive7: joined.filter((s) => s.activeDays7 === 0).length,
    tests7: joined.reduce((n, s) => n + s.tests7, 0),
    avgPct30: withScores.length ? Math.round(withScores.reduce((n, s) => n + s.avgPct30, 0) / withScores.length) : null,
    topWeakChapters: Object.entries(chapterAgg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, wrong]) => { const [chapter, subject] = k.split("|"); return { chapter, subject, wrong }; }),
  };
  return { summary, students };
}

// Full picture for one student: recent tests, subject averages, weak chapters.
async function studentDetail(userId) {
  const id = String(userId);
  const d90 = new Date(Date.now() - 90 * DAY);
  const [user, tests, weak] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, streak: { select: { current: true, longest: true } }, profile: { select: { class: true, targetScore: true } } } }),
    prisma.attempt.findMany({
      where: { userId: id, status: "submitted" },
      select: { score: true, totalMarks: true, accuracy: true, physicsScore: true, chemScore: true, bioScore: true, timeTaken: true, submittedAt: true, mockTest: { select: { title: true, type: true, subject: true } } },
      orderBy: { submittedAt: "desc" },
      take: 30,
    }),
    weakChaptersFor([id], d90),
  ]);
  if (!user) return { joined: false };
  const full = tests.filter(isFull);
  const avg = (k) => (full.length ? Math.round(full.reduce((n, a) => n + a[k], 0) / full.length) : null);
  return {
    joined: true,
    classLevel: user.profile?.class || null,
    targetScore: user.profile?.targetScore || null,
    streak: user.streak?.current || 0,
    longestStreak: user.streak?.longest || 0,
    subjectAvg: { physics: avg("physicsScore"), chemistry: avg("chemScore"), biology: avg("bioScore"), fullMocks: full.length },
    tests: tests.map((a) => ({ title: a.mockTest?.title || "Test", date: a.submittedAt, score: a.score, total: a.totalMarks || 720, pct: pctOf(a), accuracy: Math.round(a.accuracy || 0), physics: a.physicsScore, chemistry: a.chemScore, biology: a.bioScore, minutes: Math.round((a.timeTaken || 0) / 60) })),
    weakChapters: weak.sort((x, y) => y.wrong - x.wrong).slice(0, 8).map((w) => ({ subject: w.subject, chapter: w.chapter, wrong: w.wrong })),
  };
}

module.exports = { institutesSummary, studentDetail };
