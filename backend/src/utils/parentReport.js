const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d) => new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10); // IST date
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The last 7 days of a student's real activity, with the previous 7 days for
// comparison. Used by the weekly parent email and the "Share on WhatsApp" button.
async function buildParentReport(userId) {
  const now = new Date();
  const from = new Date(now - 7 * DAY_MS);
  const prevFrom = new Date(now - 14 * DAY_MS);

  const [user, attempts, prevAttempts, quizzes, practice, wrong] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true, streak: true, subscription: true } }),
    prisma.attempt.findMany({
      where: { userId, status: "submitted", submittedAt: { gte: from } },
      select: { score: true, totalMarks: true, accuracy: true, physicsScore: true, chemScore: true, bioScore: true, submittedAt: true, mockTest: { select: { title: true, type: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.attempt.findMany({ where: { userId, status: "submitted", submittedAt: { gte: prevFrom, lt: from } }, select: { score: true, totalMarks: true } }),
    prisma.quizResult.findMany({ where: { userId, createdAt: { gte: from } }, select: { score: true, total: true, createdAt: true } }),
    prisma.practiceStat.findMany({ where: { userId, solvedAt: { gte: from } }, select: { correct: true, solvedAt: true } }),
    // Wrong (attempted) answers this week, counted per chapter in the database.
    prisma.$queryRaw`
      SELECT q.subject AS subject, q.chapter AS chapter, COUNT(*)::int AS wrong
      FROM attempt_responses r
      JOIN attempts a ON a.id = r."attemptId"
      JOIN questions q ON q.id = r."questionId"
      WHERE a."userId" = ${userId} AND a.status = 'submitted' AND a."submittedAt" >= ${from}
        AND r."isCorrect" = false AND r.selected IS NOT NULL
      GROUP BY q.subject, q.chapter`,
  ]);
  if (!user) return null;

  // Scores are compared as a share of full marks so a 180-mark chapter test and a
  // 720-mark full mock can sit side by side.
  const fullMocks = attempts.filter((a) => (a.totalMarks || 720) >= 600);
  const avgPct = (list) => (list.length ? Math.round(list.reduce((n, a) => n + pct(a.score, a.totalMarks || 720), 0) / list.length) : null);
  const thisAvg = avgPct(attempts);
  const prevAvg = avgPct(prevAttempts);
  const best = fullMocks.length ? Math.max(...fullMocks.map((a) => a.score)) : null;
  const latestFull = fullMocks[fullMocks.length - 1] || null;

  const chapters = {};
  wrong.forEach((r) => { const k = `${r.chapter} (${r.subject})`; chapters[k] = (chapters[k] || 0) + Number(r.wrong); });
  const weakChapters = Object.entries(chapters).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const activeDays = new Set([
    ...attempts.map((a) => dayKey(a.submittedAt)),
    ...quizzes.map((q) => dayKey(q.createdAt)),
    ...practice.map((p) => dayKey(p.solvedAt)),
  ]).size;

  const sub = user.subscription;
  const planActive = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > now;
  const planDaysLeft = planActive ? Math.ceil((new Date(sub.endDate) - now) / DAY_MS) : 0;

  const stats = {
    name: user.name,
    firstName: (user.name || "").split(" ")[0],
    period: `${fmt(from)} – ${fmt(now)}`,
    tests: attempts.length,
    fullMocks: fullMocks.length,
    avgPct: thisAvg,
    prevAvgPct: prevAvg,
    trend: thisAvg != null && prevAvg != null ? thisAvg - prevAvg : null,
    bestScore: best,
    latest: latestFull && { score: latestFull.score, physics: latestFull.physicsScore, chemistry: latestFull.chemScore, biology: latestFull.bioScore },
    accuracy: attempts.length ? Math.round(attempts.reduce((n, a) => n + (a.accuracy || 0), 0) / attempts.length) : null,
    quizDays: quizzes.length,
    quizPct: quizzes.length ? pct(quizzes.reduce((n, q) => n + q.score, 0), quizzes.reduce((n, q) => n + q.total, 0)) : null,
    practiceSolved: practice.length,
    practicePct: practice.length ? pct(practice.filter((p) => p.correct).length, practice.length) : null,
    activeDays,
    streak: activeDays ? user.streak?.current || 0 : 0,
    targetScore: user.profile?.targetScore || null,
    weakChapters,
    planActive,
    planEnds: planActive ? fmt(sub.endDate) : null,
    planDaysLeft,
    neetDate: user.profile?.neetDate || null,
  };
  stats.daysToNeet = stats.neetDate ? Math.max(0, Math.ceil((new Date(stats.neetDate) - now) / DAY_MS)) : null;
  return stats;
}

const APP = () => process.env.FRONTEND_URL || "https://app.yneet.in";

const verdict = (s) => {
  if (!s.tests && !s.quizDays && !s.practiceSolved) return `${s.firstName} did not study on YNeet this week. A gentle reminder from you can help them get back on track.`;
  if (s.activeDays >= 5) return `Great consistency: ${s.firstName} studied on ${s.activeDays} of the last 7 days. 👏`;
  if (s.activeDays >= 3) return `${s.firstName} studied on ${s.activeDays} days this week. Aiming for 5+ days will build stronger habits.`;
  return `${s.firstName} studied on only ${s.activeDays} day${s.activeDays === 1 ? "" : "s"} this week. Regular daily practice makes the biggest difference for NEET.`;
};

// Plain text for WhatsApp (uses *bold*).
function reportText(s) {
  const L = [];
  L.push(`📊 *YNeet weekly report – ${s.name}*`);
  L.push(`${s.period}`);
  L.push("");
  L.push(verdict(s));
  L.push("");
  L.push(`📅 Days studied: *${s.activeDays}/7*  |  🔥 Streak: *${s.streak} days*`);
  L.push(`📝 Tests taken: *${s.tests}*${s.fullMocks ? ` (${s.fullMocks} full NEET mock${s.fullMocks > 1 ? "s" : ""})` : ""}`);
  if (s.avgPct != null) L.push(`🎯 Average test score: *${s.avgPct}%*${s.trend != null ? ` (${s.trend >= 0 ? "▲" : "▼"} ${Math.abs(s.trend)}% vs last week)` : ""}`);
  if (s.latest) L.push(`🩺 Latest full mock: *${s.latest.score}/720*  (Physics ${s.latest.physics}, Chemistry ${s.latest.chemistry}, Biology ${s.latest.biology})`);
  if (s.bestScore != null && s.targetScore) L.push(`🏁 Best this week: *${s.bestScore}/720*  |  Target: ${s.targetScore}/720`);
  if (s.accuracy != null) L.push(`✅ Accuracy: *${s.accuracy}%*`);
  if (s.quizDays) L.push(`⚡ Daily quiz: *${s.quizDays} day${s.quizDays > 1 ? "s" : ""}*, ${s.quizPct}% correct`);
  if (s.practiceSolved) L.push(`📖 Practice: *${s.practiceSolved} questions*, ${s.practicePct}% correct`);
  if (s.weakChapters.length) { L.push(""); L.push(`📌 Needs more practice: ${s.weakChapters.join(", ")}`); }
  if (s.daysToNeet) L.push(`⏳ ${s.daysToNeet} days to NEET`);
  if (!s.planActive) { L.push(""); L.push(`⚠️ ${s.firstName}'s YNeet plan is not active. Renew: ${APP()}/pricing`); }
  else if (s.planDaysLeft <= 5) { L.push(""); L.push(`⚠️ Plan ends ${s.planEnds}. Renew in time: ${APP()}/pricing`); }
  L.push("");
  L.push(`– YNeet, NEET preparation | www.yneet.in`);
  return L.join("\n");
}

function reportHtml(s) {
  const row = (k, v) => `<tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0;">${k}</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${v}</td></tr>`;
  const rows = [
    row("Days studied", `${s.activeDays} / 7`),
    row("Study streak", `${s.streak} days`),
    row("Tests taken", `${s.tests}${s.fullMocks ? ` (${s.fullMocks} full mock${s.fullMocks > 1 ? "s" : ""})` : ""}`),
    s.avgPct != null && row("Average test score", `${s.avgPct}%${s.trend != null ? ` <span style="color:${s.trend >= 0 ? "#16a34a" : "#dc2626"};font-weight:600;">${s.trend >= 0 ? "▲" : "▼"} ${Math.abs(s.trend)}%</span>` : ""}`),
    s.latest && row("Latest full mock", `${s.latest.score} / 720`),
    s.latest && row("&nbsp;&nbsp;Physics · Chemistry · Biology", `${s.latest.physics} · ${s.latest.chemistry} · ${s.latest.biology}`),
    s.bestScore != null && row("Best mock this week", `${s.bestScore} / 720`),
    s.targetScore && row("Target score", `${s.targetScore} / 720`),
    s.accuracy != null && row("Accuracy", `${s.accuracy}%`),
    s.quizDays && row("Daily quiz", `${s.quizDays} day${s.quizDays > 1 ? "s" : ""} · ${s.quizPct}% correct`),
    s.practiceSolved && row("Practice questions", `${s.practiceSolved} · ${s.practicePct}% correct`),
    s.daysToNeet && row("Days to NEET", s.daysToNeet),
  ].filter(Boolean).join("");
  const warn = !s.planActive
    ? `<p style="background:#fef2f2;color:#991b1b;padding:12px;border-radius:8px;font-size:14px;">${esc(s.firstName)}'s YNeet plan is not active, so they can't take tests right now. <a href="${APP()}/pricing">Renew here</a>.</p>`
    : s.planDaysLeft <= 5 ? `<p style="background:#fffbeb;color:#92400e;padding:12px;border-radius:8px;font-size:14px;">Plan ends on ${s.planEnds}. <a href="${APP()}/pricing">Renew in time</a> so practice doesn't stop.</p>` : "";
  return `
    <h2 style="color:#0f172a;margin:0 0 4px;">Weekly report: ${esc(s.name)}</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">${s.period}</p>
    <p style="color:#334155;font-size:15px;">${esc(verdict(s))}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}</table>
    ${s.weakChapters.length ? `<p style="color:#475569;font-size:14px;">Chapters that need more practice: <strong>${esc(s.weakChapters.join(", "))}</strong></p>` : ""}
    ${warn}`;
}

module.exports = { buildParentReport, reportText, reportHtml };
