const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// "Academic Intelligence" for an institute: batch-level learning gaps built from
// its own students' YNeet test answers. Called server-to-server by Raise Academy,
// which decides which student ids an institute may see. Read-only — no schema use
// beyond existing tables (attempts, attempt_responses, questions).

const DAY = 24 * 60 * 60 * 1000;
const MIN_CHAPTER_ANSWERS = 10; // below this a chapter's accuracy is noise
const MIN_TOPIC_ANSWERS = 5;
const MIN_CELL_ANSWERS = 3; // student × chapter cell
const GRID_CHAPTERS = 6;

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// Configurable bands from the spec: <40 critical, 40–60 needs work, 60–75 satisfactory, 75+ strong.
const statusOf = (acc) => (acc == null ? null : acc < 40 ? "critical" : acc < 60 ? "needs_work" : acc < 75 ? "satisfactory" : "strong");

const SCORE_BANDS = [[0, 100], [100, 200], [200, 300], [300, 400], [400, 500], [500, 600], [600, 721]];
const READINESS = [
  { key: "strong", label: "Strong (600+)", min: 600 },
  { key: "good", label: "Good (500–599)", min: 500 },
  { key: "moderate", label: "Moderate (350–499)", min: 350 },
  { key: "support", label: "Needs intensive support (below 350)", min: -Infinity },
];

async function fetchRows(ids, since, prevSince) {
  const [topicRows, cellRows, mocks] = await Promise.all([
    // Batch-wide answers by topic, split into this period vs the one before it.
    prisma.$queryRaw`
      SELECT q.subject AS subject, q.chapter AS chapter, q.topic AS topic,
             (a."submittedAt" >= ${since}) AS cur,
             COUNT(*)::int AS total,
             COUNT(r.selected)::int AS answered,
             COUNT(*) FILTER (WHERE r.selected IS NOT NULL AND r."isCorrect")::int AS correct,
             COALESCE(SUM(r."timeSec") FILTER (WHERE r.selected IS NOT NULL), 0)::int AS "timeSec"
      FROM attempt_responses r
      JOIN attempts a ON a.id = r."attemptId"
      JOIN questions q ON q.id = r."questionId"
      WHERE a."userId" = ANY(${ids}) AND a.status = 'submitted' AND a."submittedAt" >= ${prevSince}
      GROUP BY q.subject, q.chapter, q.topic, cur`,
    // Per student × chapter, this period only.
    prisma.$queryRaw`
      SELECT a."userId" AS "userId", q.subject AS subject, q.chapter AS chapter,
             COUNT(r.selected)::int AS answered,
             COUNT(*) FILTER (WHERE r.selected IS NOT NULL AND r."isCorrect")::int AS correct
      FROM attempt_responses r
      JOIN attempts a ON a.id = r."attemptId"
      JOIN questions q ON q.id = r."questionId"
      WHERE a."userId" = ANY(${ids}) AND a.status = 'submitted' AND a."submittedAt" >= ${since}
      GROUP BY a."userId", q.subject, q.chapter`,
    // Full mocks this period, for score bands.
    prisma.attempt.findMany({
      where: { userId: { in: ids }, status: "submitted", submittedAt: { gte: since }, totalMarks: { gte: 600 } },
      select: { userId: true, score: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),
  ]);
  return { topicRows, cellRows, mocks };
}

// Pure: turns raw rows into the report. Kept separate from the queries so it can be tested.
function buildReport({ ids, days, topicRows, cellRows, mocks }) {
  const chapters = {};
  const key = (s, c) => `${s}|${c}`;
  for (const r of topicRows) {
    const k = key(r.subject, r.chapter);
    const ch = (chapters[k] = chapters[k] || { subject: r.subject, chapter: r.chapter, cur: { total: 0, answered: 0, correct: 0, timeSec: 0 }, prev: { answered: 0, correct: 0 }, topics: {} });
    if (r.cur) {
      ch.cur.total += r.total; ch.cur.answered += r.answered; ch.cur.correct += r.correct; ch.cur.timeSec += r.timeSec;
      const tp = (ch.topics[r.topic || "General"] = ch.topics[r.topic || "General"] || { answered: 0, correct: 0 });
      tp.answered += r.answered; tp.correct += r.correct;
    } else {
      ch.prev.answered += r.answered; ch.prev.correct += r.correct;
    }
  }

  const studentsByChapter = {};
  const studentTotals = {};
  for (const r of cellRows) {
    const k = key(r.subject, r.chapter);
    (studentsByChapter[k] = studentsByChapter[k] || {})[r.userId] = r;
    const t = (studentTotals[r.userId] = studentTotals[r.userId] || { answered: 0, correct: 0 });
    t.answered += r.answered; t.correct += r.correct;
  }

  const chapterList = Object.entries(chapters)
    .filter(([, c]) => c.cur.answered >= MIN_CHAPTER_ANSWERS)
    .map(([k, c]) => {
      const accuracy = pct(c.cur.correct, c.cur.answered);
      const prevAccuracy = c.prev.answered >= MIN_CHAPTER_ANSWERS ? pct(c.prev.correct, c.prev.answered) : null;
      const topics = Object.entries(c.topics)
        .filter(([, t]) => t.answered >= MIN_TOPIC_ANSWERS)
        .map(([topic, t]) => ({ topic, answered: t.answered, accuracy: pct(t.correct, t.answered), status: statusOf(pct(t.correct, t.answered)) }))
        .sort((a, b) => a.accuracy - b.accuracy);
      return {
        subject: c.subject,
        chapter: c.chapter,
        answered: c.cur.answered,
        students: Object.keys(studentsByChapter[k] || {}).length,
        accuracy,
        prevAccuracy,
        change: prevAccuracy == null ? null : accuracy - prevAccuracy,
        skippedPct: pct(c.cur.total - c.cur.answered, c.cur.total),
        avgTimeSec: c.cur.answered ? Math.round(c.cur.timeSec / c.cur.answered) : null,
        status: statusOf(accuracy),
        weakestTopic: topics[0] || null,
        topics,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);

  // Subject roll-up
  const subj = {};
  for (const c of Object.values(chapters)) {
    const s = (subj[c.subject] = subj[c.subject] || { answered: 0, correct: 0 });
    s.answered += c.cur.answered; s.correct += c.cur.correct;
  }
  const subjects = Object.entries(subj)
    .filter(([, s]) => s.answered > 0)
    .map(([subject, s]) => ({ subject, answered: s.answered, accuracy: pct(s.correct, s.answered), status: statusOf(pct(s.correct, s.answered)) }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Student × chapter grid: the weakest few chapters of each subject. The overall
  // weakest few are always among them, so the UI can show "all subjects" too.
  const gridChapterKeys = [];
  const perSubjectCount = {};
  for (const c of chapterList) {
    perSubjectCount[c.subject] = (perSubjectCount[c.subject] || 0) + 1;
    if (perSubjectCount[c.subject] <= GRID_CHAPTERS) gridChapterKeys.push(key(c.subject, c.chapter));
  }
  const grid = {
    chapters: gridChapterKeys.map((k) => { const [subject, chapter] = k.split("|"); return { subject, chapter }; }),
    students: ids
      .filter((id) => studentTotals[id])
      .map((id) => ({
        userId: id,
        accuracy: pct(studentTotals[id].correct, studentTotals[id].answered),
        answered: studentTotals[id].answered,
        cells: gridChapterKeys.map((k) => {
          const r = studentsByChapter[k]?.[id];
          return r && r.answered >= MIN_CELL_ANSWERS ? pct(r.correct, r.answered) : null;
        }),
      })),
  };

  // Latest full mock per student → score distribution + readiness
  const latest = {};
  for (const m of mocks) latest[m.userId] = m.score; // ordered ascending, so last wins
  const scores = Object.values(latest);
  const distribution = SCORE_BANDS.map(([lo, hi]) => ({
    band: hi > 720 ? `${lo}–720` : `${lo}–${hi}`,
    count: scores.filter((s) => (lo === 0 ? s < hi : s >= lo && s < hi)).length,
  }));
  const readiness = READINESS.map((b, i) => ({
    key: b.key, label: b.label,
    count: scores.filter((s) => s >= b.min && (i === 0 || s < READINESS[i - 1].min)).length,
  }));

  // Same chapter, this period vs the previous one (proxy for "did revision work").
  const changes = chapterList.filter((c) => c.change != null).sort((a, b) => b.change - a.change);
  const revision = {
    improved: changes.filter((c) => c.change > 0).slice(0, 5).map((c) => ({ subject: c.subject, chapter: c.chapter, before: c.prevAccuracy, after: c.accuracy, change: c.change })),
    declined: changes.filter((c) => c.change < 0).reverse().slice(0, 5).map((c) => ({ subject: c.subject, chapter: c.chapter, before: c.prevAccuracy, after: c.accuracy, change: c.change })),
  };

  const totalAnswered = chapterList.reduce((n, c) => n + c.answered, 0);
  const totalCorrect = Object.values(chapters).reduce((n, c) => n + c.cur.correct, 0);
  const allAnswered = Object.values(chapters).reduce((n, c) => n + c.cur.answered, 0);
  const testedStudents = Object.keys(studentTotals).length;

  const summary = {
    days,
    students: ids.length,
    testedStudents,
    participationPct: pct(testedStudents, ids.length),
    answers: allAnswered,
    accuracy: pct(totalCorrect, allAnswered),
    criticalChapters: chapterList.filter((c) => c.status === "critical").length,
    fullMockStudents: scores.length,
    needsSupport: grid.students.filter((s) => s.accuracy != null && s.accuracy < 45).length,
  };

  return { summary, recommendation: recommend(chapterList, summary), chapters: chapterList, subjects, grid, distribution, readiness, revision, enough: totalAnswered > 0 };
}

// Rule-based "what to do next" — deterministic, free, and explainable to a teacher.
function recommend(chapterList, summary) {
  // Prefer chapters several students actually attempted, so one student's bad day doesn't top the list.
  const pool = chapterList.filter((c) => c.students >= Math.min(3, Math.max(1, summary.testedStudents))).filter((c) => c.status === "critical" || c.status === "needs_work");
  if (!pool.length) {
    return chapterList.length
      ? { priority: "low", title: "No chapter is below 60% right now", body: "Keep chapters in weekly mixed tests so they stay strong. Push students to attempt more questions to widen coverage.", steps: [], next: [] }
      : null;
  }
  const w = pool[0];
  const t = w.weakestTopic;
  const trend = w.change == null ? "" : w.change >= 0 ? ` (up ${w.change} points since the previous period)` : ` (down ${Math.abs(w.change)} points since the previous period)`;
  return {
    priority: w.status === "critical" ? "high" : "medium",
    subject: w.subject,
    chapter: w.chapter,
    title: `${w.chapter} needs attention first`,
    body: `Batch accuracy in ${w.chapter} (${w.subject}) is ${w.accuracy}%${trend}, across ${w.students} student${w.students === 1 ? "" : "s"}.` +
      (t ? ` Most marks are lost on ${t.topic} (${t.accuracy}%).` : "") +
      (w.skippedPct >= 20 ? ` Students skip ${w.skippedPct}% of these questions — they lack confidence, not just accuracy.` : ""),
    steps: [
      t ? `Run a 45-minute concept class on ${t.topic}.` : `Run a 45-minute revision class on ${w.chapter}.`,
      `Ask students to take the ${w.chapter} chapter test and practise 20 more questions on YNeet.`,
      "Check this page again in 7 days to see if accuracy moved.",
    ],
    next: pool.slice(1, 3).map((c) => ({ subject: c.subject, chapter: c.chapter, accuracy: c.accuracy })),
  };
}

// Short WhatsApp-ready summary for the institute owner.
function reportText(r, instituteName) {
  const s = r.summary;
  const lines = [
    `📊 *YNeet weekly insights${instituteName ? ` · ${instituteName}` : ""}*`,
    `Last ${s.days} days`,
    "",
    `✅ ${s.testedStudents} of ${s.students} students took tests (${s.participationPct ?? 0}%)`,
    s.accuracy != null ? `🎯 Batch accuracy: ${s.accuracy}%` : null,
  ];
  const weak = r.chapters.filter((c) => c.status === "critical" || c.status === "needs_work").slice(0, 3);
  if (weak.length) { lines.push("", "🔴 *Fix first*"); weak.forEach((c, i) => lines.push(`${i + 1}. ${c.chapter} (${c.subject}) — ${c.accuracy}%`)); }
  if (r.recommendation?.steps?.length) { lines.push("", "💡 *Suggested this week*", r.recommendation.steps[0]); }
  const up = r.revision.improved[0];
  if (up) lines.push("", `🎉 ${up.chapter} improved ${up.before}% → ${up.after}%.`);
  if (s.needsSupport) lines.push("", `👥 ${s.needsSupport} student${s.needsSupport === 1 ? "" : "s"} below 45% accuracy need extra support.`);
  return lines.filter((l) => l !== null).join("\n");
}

async function instituteAnalytics(userIds, days = 30) {
  const ids = [...new Set((userIds || []).map(String))].slice(0, 1000);
  const d = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const now = Date.now();
  const since = new Date(now - d * DAY);
  const prevSince = new Date(now - 2 * d * DAY);
  if (!ids.length) return buildReport({ ids, days: d, topicRows: [], cellRows: [], mocks: [] });
  const rows = await fetchRows(ids, since, prevSince);
  return buildReport({ ids, days: d, ...rows });
}

module.exports = { instituteAnalytics, buildReport, reportText, statusOf };
