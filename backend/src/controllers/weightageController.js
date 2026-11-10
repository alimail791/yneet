// Chapter Priority map + weightage-based study plan.
//
// GET  /api/v1/weightage/map   — every chapter in the student's syllabus with
//      expected NEET questions, the student's own accuracy, and "marks at
//      risk" (how many marks that chapter is likely costing them).
// POST /api/v1/weightage/plan  — builds a day-by-day plan up to exam day from
//      that map and saves it in the existing StudyPlan row (same weeks/days/
//      tasks shape the Planner page already renders).
//
// No schema changes: uses Question, PracticeStat, AttemptResponse, Profile,
// StudyPlan as they are.

const { PrismaClient } = require("@prisma/client");
const { SUBJECT_TOTAL, baselineChapters, scopeClasses, keyOf } = require("../utils/weightage");
const prisma = new PrismaClient();

// A PYQ year counts for a subject only when most of that paper is in the bank
// (≥70%: 32 of 45 Physics/Chemistry, 63 of 90 Biology) — partial years would skew shares.
const MIN_YEAR_SHARE = 0.7;
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- dates (IST, plain YYYY-MM-DD strings) ----------
function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
const isSunday = (iso) => new Date(iso + "T00:00:00Z").getUTCDay() === 0;

// Profile date if set and still ahead; otherwise the next expected NEET (first Sunday of May is
// typical — 3 May is the working default until NTA announces the real date).
function defaultExamDate(profile) {
  const today = todayIST();
  const fromProfile = profile?.neetDate || (profile?.examYear ? `${profile.examYear}-05-03` : null);
  if (fromProfile && /^\d{4}-\d{2}-\d{2}$/.test(fromProfile) && fromProfile > today) return fromProfile;
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-05-03`;
  return thisYear > today ? thisYear : `${y + 1}-05-03`;
}

// ---------- the map ----------
async function buildMap(userId, profile) {
  const studentClass = profile?.class || "12th";
  const classes = scopeClasses(studentClass);
  if (!classes.length) return { supported: false, classLevel: studentClass, chapters: [] };

  // All NEET chapters first (so per-subject totals can be normalised), filtered to scope at the end.
  const base = baselineChapters();
  const subjectKey = (s, k) => `${s}|${k}`;

  const [pyqRows, bankRows, practice, responses] = await Promise.all([
    prisma.question.groupBy({ by: ["pyqYear", "subject", "chapter"], where: { isPYQ: true, pyqYear: { not: null } }, _count: { _all: true } }),
    // Practice questions available in the student's own class (that's what /practice serves).
    prisma.question.groupBy({ by: ["subject", "chapter"], where: { classLevel: studentClass }, _count: { _all: true } }),
    prisma.practiceStat.findMany({ where: { userId }, select: { correct: true, question: { select: { subject: true, chapter: true } } } }),
    prisma.attemptResponse.findMany({ where: { attempt: { userId }, selected: { not: null } }, select: { isCorrect: true, question: { select: { subject: true, chapter: true } } } }),
  ]);

  // PYQ-based weightage: share of each subject-year's tagged questions, scaled to the paper.
  const yearTotals = {}; // subject|year -> n
  for (const r of pyqRows) {
    const k = `${r.subject}|${r.pyqYear}`;
    yearTotals[k] = (yearTotals[k] || 0) + r._count._all;
  }
  const usableYears = {}; // subject -> Set(year)
  for (const [k, n] of Object.entries(yearTotals)) {
    const [subject, year] = k.split("|");
    if (!SUBJECT_TOTAL[subject] || n < SUBJECT_TOTAL[subject] * MIN_YEAR_SHARE) continue;
    (usableYears[subject] ||= new Set()).add(year);
  }
  const pyqShare = {}; // subject|chapterKey -> summed share
  const pyqCount = {}; // subject|chapterKey -> PYQs in bank (any year)
  const pyqName = {}; // subject|chapterKey -> chapter name as stored in the bank
  for (const r of pyqRows) {
    const ck = subjectKey(r.subject, keyOf(r.chapter));
    pyqCount[ck] = (pyqCount[ck] || 0) + r._count._all;
    pyqName[ck] ||= r.chapter;
    if (!usableYears[r.subject]?.has(String(r.pyqYear))) continue;
    const total = yearTotals[`${r.subject}|${r.pyqYear}`];
    pyqShare[ck] = (pyqShare[ck] || 0) + (r._count._all / total) * SUBJECT_TOTAL[r.subject];
  }

  const bank = {}; // subject|chapterKey -> { name, count }
  for (const r of bankRows) bank[subjectKey(r.subject, keyOf(r.chapter))] = { name: r.chapter, count: r._count._all };

  const perf = {}; // subject|chapterKey -> { n, c }
  for (const row of [...practice, ...responses.map((r) => ({ correct: r.isCorrect, question: r.question }))]) {
    if (!row.question) continue;
    const ck = subjectKey(row.question.subject, keyOf(row.question.chapter));
    const p = (perf[ck] ||= { n: 0, c: 0 });
    p.n++;
    if (row.correct) p.c++;
  }

  const blended = base.map((c) => {
    const years = usableYears[c.subject]?.size || 0;
    if (!years) return c.baseline;
    const fromPyq = (pyqShare[subjectKey(c.subject, c.key)] || 0) / years;
    const w = (Math.min(years, 5) / 5) * 0.7; // trust the bank more as more years are loaded
    return w * fromPyq + (1 - w) * c.baseline;
  });
  // Bank chapters whose names don't match the syllabus drop out of the blend — scale back to the real paper.
  const subjSum = {};
  base.forEach((c, i) => { subjSum[c.subject] = (subjSum[c.subject] || 0) + blended[i]; });

  const chapters = base.map((c, i) => ({ c, expected: (blended[i] / subjSum[c.subject]) * SUBJECT_TOTAL[c.subject] }))
    .filter(({ c }) => classes.includes(c.classLevel))
    .map(({ c, expected }) => {
    const ck = subjectKey(c.subject, c.key);
    const years = usableYears[c.subject]?.size || 0;
    const p = perf[ck] || { n: 0, c: 0 };
    const accuracy = p.n ? Math.round((p.c / p.n) * 100) : null;
    // Shrunk toward ~30% so 2-for-2 doesn't read as "mastered".
    const mastery = (p.c + 1.5) / (p.n + 5);
    const status = p.n < 5 ? "new" : accuracy < 50 ? "weak" : accuracy < 75 ? "ok" : "strong";
    return {
      key: c.key,
      subject: c.subject,
      classLevel: c.classLevel,
      chapter: c.chapter,
      // Name to pass to /practice?chapter= — must match the bank's spelling.
      practiceChapter: bank[ck]?.name || c.chapter,
      pyqChapter: pyqName[ck] || bank[ck]?.name || c.chapter,
      expectedQs: round1(expected),
      expectedMarks: Math.round(expected * 4),
      attempted: p.n,
      accuracy,
      status,
      marksAtRisk: round1(expected * 4 * (1 - mastery)),
      practiceCount: bank[ck]?.count || 0,
      pyqCount: pyqCount[ck] || 0,
      pyqYears: years,
    };
  });
  chapters.sort((a, b) => b.marksAtRisk - a.marksAtRisk);

  const pyqYearsUsed = Math.max(0, ...Object.values(usableYears).map((s) => s.size));
  return { supported: true, classLevel: studentClass, pyqYearsUsed, chapters };
}

exports.getMap = async (req, res) => {
  try {
    const profile = req.user.profile || (await prisma.profile.findUnique({ where: { userId: req.user.id } }));
    const map = await buildMap(req.user.id, profile);
    res.json({
      success: true,
      ...map,
      defaults: { examDate: defaultExamDate(profile), hoursPerDay: profile?.studyHoursPerDay || 6 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- the plan ----------
function task(id, text, subject, extra = {}) {
  return { id, text, subject, done: false, ...extra };
}

function buildPlan({ chapters, examDate, hoursPerDay, doneKeys }) {
  const start = todayIST();
  const totalDays = daysBetween(start, examDate); // exam day itself excluded
  const revisionDays = totalDays >= 90 ? 30 : Math.round(totalDays * 0.25);
  const learnEnd = addDays(start, totalDays - revisionDays); // first revision day

  const todo = chapters.filter((c) => !doneKeys.has(`${c.subject}|${c.key}`));
  const tracks = {
    Biology: todo.filter((c) => c.subject === "Biology"),
    PC: todo.filter((c) => c.subject !== "Biology"),
  };

  // Learning days available per track (Sundays are mock + weekly revision).
  let capacity = 0;
  for (let d = start; d < learnEnd; d = addDays(d, 1)) if (!isSunday(d)) capacity++;

  // Days per chapter: ~1 + 0.5 per expected question at 6 h/day, scaled to the student's hours,
  // then squeezed to fit the time left (minimum 1 day each).
  const hourScale = 6 / Math.min(14, Math.max(2, hoursPerDay));
  const leftovers = [];
  const schedule = {}; // track -> [{ chapter, days }]
  for (const [name, list] of Object.entries(tracks)) {
    let want = list.map((c) => Math.max(1, (1 + c.expectedQs * 0.5) * hourScale));
    let fitted = list.slice();
    if (fitted.length > capacity) {
      leftovers.push(...fitted.slice(capacity)); // lowest priority — covered quickly in revision
      fitted = fitted.slice(0, capacity);
      want = want.slice(0, capacity);
    }
    const sum = want.reduce((a, b) => a + b, 0);
    // Squeeze when short of time; when there's plenty, spread chapters out (up to 2x)
    // but keep ~10% of days free as buffer for catching up.
    const factor = sum > capacity ? capacity / sum : Math.max(1, Math.min(2, (capacity * 0.9) / sum));
    let days = want.map((w) => Math.max(1, Math.floor(w * factor)));
    // Hand out the rounding remainder to the top-priority chapters.
    let spare = Math.min(capacity, Math.round(sum * factor)) - days.reduce((a, b) => a + b, 0);
    for (let i = 0; spare > 0 && i < days.length; i++, spare--) days[i]++;
    // The 1-day minimum can push the total past capacity — trim from the lowest-priority end.
    let over = days.reduce((a, b) => a + b, 0) - capacity;
    for (let i = days.length - 1; over > 0 && i >= 0; i = i === 0 ? days.length - 1 : i - 1) {
      if (days[i] > 1) { days[i]--; over--; } else if (days.every((x) => x === 1)) break;
    }
    schedule[name] = fitted.map((c, i) => ({ c, days: days[i] }));
  }

  // Expand each track into a per-learning-day queue of tasks.
  function expand(list) {
    const queue = [];
    for (const { c, days } of list) {
      for (let i = 1; i <= days; i++) {
        const last = i === days;
        const t = [];
        const part = days > 1 ? ` (part ${i}/${days})` : "";
        if (!(last && days > 1)) t.push(task(null, `📘 Study ${c.chapter} — NCERT + notes${part}`, c.subject, { kind: "study", chapterKey: `${c.subject}|${c.key}` }));
        if (last) {
          t.push(task(null, `✍️ Practice 20 MCQs: ${c.chapter}`, c.subject, {
            kind: "practice", chapterKey: `${c.subject}|${c.key}`,
            link: `/practice?subject=${encodeURIComponent(c.subject)}&chapter=${encodeURIComponent(c.practiceChapter)}`,
          }));
          if (c.pyqCount > 0) t.push(task(null, `📅 Solve PYQs: ${c.chapter}`, c.subject, {
            kind: "pyq", chapterKey: `${c.subject}|${c.key}`,
            link: `/practice?subject=${encodeURIComponent(c.subject)}&chapter=${encodeURIComponent(c.pyqChapter)}&pyq=1`,
          }));
        }
        queue.push({ tasks: t, chapter: c.chapter });
      }
    }
    return queue;
  }
  const qBio = expand(schedule.Biology || []);
  const qPC = expand(schedule.PC || []);
  const weakest = chapters[0];

  const days = [];
  let learnIdx = 0;
  let weekChapters = [];
  for (let d = start; d < learnEnd; d = addDays(d, 1)) {
    const tasks = [];
    if (isSunday(d)) {
      tasks.push(task(null, "📝 Full-length mock test (3 hrs, exam timing)", "Mixed", { kind: "mock", link: "/mock" }));
      tasks.push(task(null, `🔁 Revise this week's chapters${weekChapters.length ? `: ${[...new Set(weekChapters)].slice(0, 4).join(", ")}` : ""} + Mistake Notebook`, "Mixed", { kind: "revise", link: "/mistakes" }));
      weekChapters = [];
    } else {
      for (const q of [qBio, qPC]) {
        const slot = q[learnIdx];
        if (slot) { tasks.push(...slot.tasks.map((t) => ({ ...t }))); weekChapters.push(slot.chapter); }
      }
      if (!tasks.length) {
        tasks.push(task(null, `🛟 Buffer day — finish anything you missed, then practice your top-priority chapter${weakest ? ` (${weakest.chapter})` : ""}`, weakest?.subject || "Mixed", {
          kind: "buffer",
          ...(weakest ? { link: `/practice?subject=${encodeURIComponent(weakest.subject)}&chapter=${encodeURIComponent(weakest.practiceChapter)}` } : {}),
        }));
      }
      learnIdx++;
    }
    days.push({ date: d, day: dayLabel(d), phase: "learn", tasks });
  }

  // Revision phase: cycle through chapters by priority (leftovers first, they were never studied),
  // full mock every 3rd day, light final day.
  const revOrder = [...leftovers, ...chapters.filter((c) => !leftovers.includes(c))];
  let r = 0;
  for (let i = 0, d = learnEnd; d < examDate; i++, d = addDays(d, 1)) {
    const tasks = [];
    const isLast = addDays(d, 1) === examDate;
    if (isLast) {
      tasks.push(task(null, "🌙 Light revision of formulas & diagrams only. Check admit card, pack documents, sleep early.", "Mixed", { kind: "revise" }));
    } else if (i % 3 === 2) {
      tasks.push(task(null, "📝 Full-length mock test", "Mixed", { kind: "mock", link: "/mock" }));
      tasks.push(task(null, "🔍 Analyse the mock — redo every wrong question", "Mixed", { kind: "revise", link: "/mistakes?source=mock" }));
    } else {
      for (let k = 0; k < 3 && revOrder.length; k++, r++) {
        const c = revOrder[r % revOrder.length];
        const quick = leftovers.includes(c) && r < revOrder.length;
        tasks.push(task(null, `${quick ? "⚡ Quick cover" : "🔁 Revise"} ${c.chapter} — key points + 20 MCQs`, c.subject, {
          kind: "revise", chapterKey: `${c.subject}|${c.key}`,
          link: `/practice?subject=${encodeURIComponent(c.subject)}&chapter=${encodeURIComponent(c.practiceChapter)}`,
        }));
      }
    }
    days.push({ date: d, day: dayLabel(d), phase: "revision", tasks });
  }

  // Ids + weeks of 7 days.
  let n = 0;
  for (const day of days) for (const t of day.tasks) t.id = `w${++n}`;
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const revision = chunk.every((d) => d.phase === "revision");
    const learnt = [...new Set(chunk.flatMap((d) => d.tasks.filter((t) => t.kind === "practice").map((t) => t.text.replace("✍️ Practice 20 MCQs: ", ""))))];
    weeks.push({
      weekNumber: weeks.length + 1,
      focus: revision ? "Revision + mock tests" : learnt.length ? `Finish: ${learnt.slice(0, 4).join(", ")}${learnt.length > 4 ? ` +${learnt.length - 4} more` : ""}` : "Keep going — study & practice",
      days: chunk,
    });
  }

  return {
    source: "weightage",
    version: 2,
    createdAt: new Date().toISOString(),
    startDate: start,
    examDate,
    hoursPerDay,
    chaptersPlanned: todo.length,
    chaptersSkipped: doneKeys.size,
    // Chapters with no full study slot (only a quick cover in revision, or none if time is very short).
    chaptersNotFit: leftovers.length,
    weeks,
  };
}

exports.createPlan = async (req, res) => {
  try {
    const profile = req.user.profile || (await prisma.profile.findUnique({ where: { userId: req.user.id } }));
    const map = await buildMap(req.user.id, profile);
    if (!map.supported) return res.status(400).json({ success: false, message: "The chapter plan is for Class 11, 12 and Dropper students." });

    const today = todayIST();
    let examDate = String(req.body.examDate || "") || defaultExamDate(profile);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate <= today) return res.status(400).json({ success: false, message: "Pick an exam date in the future." });
    const left = daysBetween(today, examDate);
    if (left < 7) return res.status(400).json({ success: false, message: "Less than a week left — focus on mock tests and revision instead of a new plan." });
    if (left > 800) return res.status(400).json({ success: false, message: "That exam date is too far away — pick one within about 2 years." });
    const hoursPerDay = Math.min(14, Math.max(2, Number(req.body.hoursPerDay) || profile?.studyHoursPerDay || 6));

    // Chapters the student ticked as done, plus any whose practice task was ticked in the current plan.
    const doneKeys = new Set(Array.isArray(req.body.doneKeys) ? req.body.doneKeys.map(String) : []);
    const existing = await prisma.studyPlan.findUnique({ where: { userId: req.user.id } });
    for (const w of existing?.plan?.weeks || []) for (const d of w.days || []) for (const t of d.tasks || []) {
      if (t.kind === "practice" && t.done && t.chapterKey) doneKeys.add(t.chapterKey);
    }

    const plan = buildPlan({ chapters: map.chapters, examDate, hoursPerDay, doneKeys });
    const saved = await prisma.studyPlan.upsert({ where: { userId: req.user.id }, update: { plan }, create: { userId: req.user.id, plan } });
    res.json({ success: true, plan: saved.plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/weightage/plan/task { taskId, done } — tick one task without
// re-sending the whole (large) plan from the phone.
exports.toggleTask = async (req, res) => {
  try {
    const { taskId, done } = req.body;
    const row = await prisma.studyPlan.findUnique({ where: { userId: req.user.id } });
    if (!row?.plan?.weeks) return res.status(404).json({ success: false, message: "No plan found." });
    let found = false;
    for (const w of row.plan.weeks) for (const d of w.days || []) for (const t of d.tasks || []) {
      if (t.id === taskId) { t.done = !!done; found = true; }
    }
    if (!found) return res.status(404).json({ success: false, message: "Task not found." });
    await prisma.studyPlan.update({ where: { userId: req.user.id }, data: { plan: row.plan } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Public, no-login weightage for every NEET chapter (www.yneet.in chapter pages
// and /neet-chapter-wise-weightage). Same PYQ/baseline blend as buildMap, without
// any student data. yearsAppeared = usable PYQ years in which the chapter had a question.
let publicCache = null;
async function publicWeightage() {
  if (publicCache && Date.now() - publicCache.at < 6 * 60 * 60 * 1000) return publicCache.value;
  const base = baselineChapters();
  const pyqRows = await prisma.question.groupBy({ by: ["pyqYear", "subject", "chapter"], where: { isPYQ: true, pyqYear: { not: null } }, _count: { _all: true } });
  const yearTotals = {};
  for (const r of pyqRows) { const k = `${r.subject}|${r.pyqYear}`; yearTotals[k] = (yearTotals[k] || 0) + r._count._all; }
  const usableYears = {};
  for (const [k, n] of Object.entries(yearTotals)) {
    const [subject, year] = k.split("|");
    if (!SUBJECT_TOTAL[subject] || n < SUBJECT_TOTAL[subject] * MIN_YEAR_SHARE) continue;
    (usableYears[subject] ||= new Set()).add(year);
  }
  const share = {}, appeared = {};
  for (const r of pyqRows) {
    if (!usableYears[r.subject]?.has(String(r.pyqYear))) continue;
    const ck = `${r.subject}|${keyOf(r.chapter)}`;
    share[ck] = (share[ck] || 0) + (r._count._all / yearTotals[`${r.subject}|${r.pyqYear}`]) * SUBJECT_TOTAL[r.subject];
    (appeared[ck] ||= new Set()).add(String(r.pyqYear));
  }
  const blended = base.map((c) => {
    const years = usableYears[c.subject]?.size || 0;
    if (!years) return c.baseline;
    const w = (Math.min(years, 5) / 5) * 0.7;
    return w * ((share[`${c.subject}|${c.key}`] || 0) / years) + (1 - w) * c.baseline;
  });
  const subjSum = {};
  base.forEach((c, i) => { subjSum[c.subject] = (subjSum[c.subject] || 0) + blended[i]; });
  const value = base.map((c, i) => ({
    subject: c.subject, classLevel: c.classLevel, chapter: c.chapter, key: c.key,
    expectedQs: (blended[i] / subjSum[c.subject]) * SUBJECT_TOTAL[c.subject],
    yearsAppeared: appeared[`${c.subject}|${c.key}`]?.size || 0,
    yearsUsed: usableYears[c.subject]?.size || 0,
  }));
  publicCache = { at: Date.now(), value };
  return value;
}
exports.publicWeightage = publicWeightage;

exports._internal ={ buildPlan, defaultExamDate, todayIST, addDays };
