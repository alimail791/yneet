const { PrismaClient } = require("@prisma/client");
const { createRotatingPool } = require("../utils/rotatingPicker");
const prisma = new PrismaClient();

// Shuffle helper (Fisher-Yates).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `count` questions out of `pool`, spreading the selection evenly
// across chapters first (round-robin) instead of letting one or two
// heavily-stocked chapters dominate the paper, then caps at whatever's
// available if the pool is smaller than requested.
function pickBalanced(pool, count) {
  const byChapter = {};
  for (const q of pool) {
    (byChapter[q.chapter] = byChapter[q.chapter] || []).push(q);
  }
  for (const ch of Object.keys(byChapter)) {
    byChapter[ch] = shuffle(byChapter[ch]);
  }
  const chapters = shuffle(Object.keys(byChapter));
  const picked = [];
  let round = 0;
  while (picked.length < count && chapters.some((ch) => byChapter[ch].length > round)) {
    for (const ch of chapters) {
      if (picked.length >= count) break;
      const bucket = byChapter[ch];
      if (bucket.length > round) picked.push(bucket[round]);
    }
    round++;
  }
  return picked.slice(0, count);
}

// GET /api/v1/admin/mock-builder/pool-stats?classLevels=11th,12th
// Tells the UI how many questions are actually available per subject for the
// chosen class scope, so it can warn before building a test the pool can't fill.
exports.getPoolStats = async (req, res) => {
  try {
    const classLevels = (req.query.classLevels || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (classLevels.length === 0) {
      return res.status(400).json({ success: false, message: "classLevels query param required" });
    }
    const rows = await prisma.question.groupBy({
      by: ["subject"],
      where: { classLevel: { in: classLevels } },
      _count: { _all: true },
    });
    const stats = { Physics: 0, Chemistry: 0, Biology: 0 };
    for (const r of rows) stats[r.subject] = r._count._all;
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/admin/mock-builder/build
// body: { title, durationMin, classLevel, poolClassLevels: ["11th","12th"], counts: {Physics, Chemistry, Biology} }
// Randomly (but chapter-balanced) assembles a mock test from the existing
// question bank, matching the same MockTest shape the manual "Create Mock
// Test" admin form already produces (title/type/classLevel/subject/
// totalMarks/totalQs/durationMin), then links the picked questions via the
// same MockTest<->Question many-to-many relation.
exports.buildMockTest = async (req, res) => {
  try {
    const { title, durationMin, classLevel, poolClassLevels, counts } = req.body;
    if (!title || !durationMin || !classLevel || !Array.isArray(poolClassLevels) || poolClassLevels.length === 0 || !counts) {
      return res.status(400).json({
        success: false,
        message: "title, durationMin, classLevel, poolClassLevels[] and counts{} are required",
      });
    }

    const subjects = ["Physics", "Chemistry", "Biology"];
    const activeSubjects = subjects.filter((s) => Number(counts[s] || 0) > 0);
    if (activeSubjects.length === 0) {
      return res.status(400).json({ success: false, message: "Set at least one subject's question count above zero." });
    }
    // Mirrors createMockTest's own convention: a single-subject paper is
    // type "subject" (tagged with that subject); anything spanning more
    // than one subject is type "full".
    const type = activeSubjects.length === 1 ? "subject" : "full";
    const subjectField = type === "subject" ? activeSubjects[0] : null;

    const selected = [];
    const shortfalls = {};
    for (const subject of activeSubjects) {
      const want = Number(counts[subject]);
      const pool = await prisma.question.findMany({
        where: { subject, classLevel: { in: poolClassLevels } },
        select: { id: true, chapter: true },
      });
      const picked = pickBalanced(pool, want);
      if (picked.length < want) shortfalls[subject] = { requested: want, available: picked.length };
      selected.push(...picked);
    }

    if (selected.length === 0) {
      return res.status(400).json({ success: false, message: "No questions found for the chosen class scope — generate content first." });
    }

    const mockTest = await prisma.mockTest.create({
      data: {
        title,
        type,
        classLevel,
        subject: subjectField,
        totalMarks: selected.length * 4, // standard NEET MCQ weighting: +4 correct
        totalQs: selected.length,
        durationMin: Number(durationMin),
        questions: { connect: selected.map((q) => ({ id: q.id })) },
      },
    });

    res.status(201).json({ success: true, mockTest, questionCount: selected.length, shortfalls });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed to build mock test" });
  }
};

// ---------------------------------------------------------------------------
// Bulk builder — generates a whole batch of mock tests (full/half/subject/
// daily, across several class levels) from the existing question bank in one
// background job, instead of one admin API call per test. Runs async so the
// HTTP request returns immediately; progress is polled via getBulkStatus.
// ---------------------------------------------------------------------------

// The Oct 2026 batch Akbar asked for. classLevel is what the test is listed
// under for students (Profile.class); poolClassLevels is which classes'
// question pools it draws from — Dropper students cover the 11th+12th
// syllabus, so Dropper pools from all three; 11th/12th each pool from their
// own class only.
function buildDefaultSpec() {
  const classes = [
    { classLevel: "Dropper", poolClassLevels: ["11th", "12th", "Dropper"], full: 30, half: 50, subjPhysics: 30, subjChemistry: 30, subjBiology: 60, daily: 200 },
    { classLevel: "12th", poolClassLevels: ["12th"], full: 10, half: 30, subjPhysics: 20, subjChemistry: 20, subjBiology: 40, daily: 100 },
    { classLevel: "11th", poolClassLevels: ["11th"], full: 10, half: 30, subjPhysics: 20, subjChemistry: 20, subjBiology: 40, daily: 100 },
  ];

  const jobs = [];
  for (const c of classes) {
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "full", subject: null,
      label: `${c.classLevel} Full Mock Test`,
      title: (i) => `${c.classLevel} Full Mock Test ${String(i).padStart(2, "0")}`,
      durationMin: 180, count: c.full,
      subjectCounts: () => ({ Physics: 45, Chemistry: 45, Biology: 90 }),
    });
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "half", subject: null,
      label: `${c.classLevel} Half Mock Test`,
      title: (i) => `${c.classLevel} Half Mock Test ${String(i).padStart(2, "0")}`,
      durationMin: 90, count: c.half,
      // Half of the full-mock ratio (Phy45/Chem45/Bio90 -> 22.5/22.5/45); the
      // odd question alternates between Physics and Chemistry so it comes out
      // exactly even (23/22 then 22/23) across the whole batch instead of
      // always favouring one subject by a point.
      subjectCounts: (i) => (i % 2 === 0 ? { Physics: 23, Chemistry: 22, Biology: 45 } : { Physics: 22, Chemistry: 23, Biology: 45 }),
    });
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "subject", subject: "Physics",
      label: `${c.classLevel} Physics Subject Test`,
      title: (i) => `${c.classLevel} Physics Subject Test ${String(i).padStart(2, "0")}`,
      durationMin: 45, count: c.subjPhysics,
      subjectCounts: () => ({ Physics: 45 }),
    });
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "subject", subject: "Chemistry",
      label: `${c.classLevel} Chemistry Subject Test`,
      title: (i) => `${c.classLevel} Chemistry Subject Test ${String(i).padStart(2, "0")}`,
      durationMin: 45, count: c.subjChemistry,
      subjectCounts: () => ({ Chemistry: 45 }),
    });
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "subject", subject: "Biology",
      label: `${c.classLevel} Biology Subject Test`,
      title: (i) => `${c.classLevel} Biology Subject Test ${String(i).padStart(2, "0")}`,
      durationMin: 45, count: c.subjBiology,
      subjectCounts: () => ({ Biology: 45 }),
    });
    jobs.push({
      classLevel: c.classLevel, poolClassLevels: c.poolClassLevels, type: "daily", subject: null,
      label: `${c.classLevel} Daily Practice`,
      title: (i) => `${c.classLevel} Daily Practice ${String(i).padStart(3, "0")}`,
      durationMin: 20, count: c.daily,
      subjectCounts: () => ({ Physics: 5, Chemistry: 5, Biology: 10 }),
    });
  }
  return jobs;
}

// Single in-memory job — one bulk run at a time is plenty for an admin-panel
// tool like this; it isn't meant to be a persisted multi-user queue.
let bulkJob = null;

// GET /api/v1/admin/mock-builder/bulk-status
exports.getBulkStatus = async (req, res) => {
  if (!bulkJob) return res.json({ success: true, job: null });
  const { log, createdTitles, ...rest } = bulkJob;
  res.json({ success: true, job: { ...rest, log: log.slice(-50), createdCount: createdTitles.length } });
};

async function runBulkJob(jobs) {
  const totalTests = jobs.reduce((sum, j) => sum + j.count, 0);
  bulkJob.total = totalTests;

  // Build every distinct (subject, poolClassLevels) rotating pool ONCE up
  // front and share it across every job/test that draws from it — e.g. all
  // six Dropper categories share the same Physics pool, so reuse spreads
  // evenly across the whole Dropper batch, not just within one category.
  const pools = {};
  const poolKey = (subject, poolClassLevels) => `${subject}||${[...poolClassLevels].sort().join(",")}`;
  async function getPool(subject, poolClassLevels) {
    const key = poolKey(subject, poolClassLevels);
    if (!pools[key]) pools[key] = await createRotatingPool(prisma, subject, poolClassLevels);
    return pools[key];
  }

  const shortfalls = {}; // poolKey -> { requested, available }

  for (const job of jobs) {
    for (let i = 1; i <= job.count; i++) {
      try {
        const counts = job.subjectCounts(i);
        const selected = [];
        for (const [subject, want] of Object.entries(counts)) {
          if (!want) continue;
          const pool = await getPool(subject, job.poolClassLevels);
          const key = poolKey(subject, job.poolClassLevels);
          const picked = pool.take(want);
          selected.push(...picked);
          const reqCount = (shortfalls[key]?.requested || 0) + want;
          shortfalls[key] = { subject, poolClassLevels: job.poolClassLevels, requested: reqCount, available: pool.size };
        }

        if (selected.length === 0) {
          bulkJob.failed++;
          bulkJob.log.push(`⚠️ Skipped ${job.title(i)}: no questions available in the pool at all.`);
          continue;
        }

        await prisma.mockTest.create({
          data: {
            title: job.title(i),
            type: job.type,
            classLevel: job.classLevel,
            subject: job.subject,
            totalMarks: selected.length * 4,
            totalQs: selected.length,
            durationMin: job.durationMin,
            questions: { connect: selected.map((q) => ({ id: q.id })) },
          },
        });

        bulkJob.done++;
        bulkJob.createdTitles.push(job.title(i));
      } catch (err) {
        bulkJob.failed++;
        bulkJob.log.push(`❌ ${job.title(i)}: ${err.message}`);
      }
    }
    bulkJob.log.push(`✅ Finished ${job.label} (${job.count} tests)`);
  }

  // Flag any pool that was asked for materially more than it actually holds —
  // not an error (reuse is expected at this volume), just visibility into
  // how many times, on average, each question got reused.
  bulkJob.shortfalls = Object.values(shortfalls)
    .filter((s) => s.requested > s.available)
    .map((s) => ({
      subject: s.subject,
      poolClassLevels: s.poolClassLevels,
      poolSize: s.available,
      totalSlotsRequested: s.requested,
      avgReusePerQuestion: s.available ? +(s.requested / s.available).toFixed(1) : null,
    }));

  bulkJob.running = false;
  bulkJob.finishedAt = new Date().toISOString();
}

// POST /api/v1/admin/mock-builder/bulk-build
// body: { jobs?: [...] } — omit to run the standard Oct 2026 batch (Dropper/
// 12th/11th full+half+subject+daily counts). Starts the job and returns
// immediately; poll bulk-status for progress. Refuses to start a second job
// while one is already running.
exports.startBulkBuild = async (req, res) => {
  if (bulkJob && bulkJob.running) {
    return res.status(409).json({ success: false, message: "A bulk build is already running.", job: bulkJob });
  }

  const jobs = buildDefaultSpec();
  bulkJob = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: jobs.reduce((sum, j) => sum + j.count, 0),
    done: 0,
    failed: 0,
    createdTitles: [],
    log: [],
    shortfalls: [],
  };

  res.status(202).json({ success: true, message: "Bulk build started.", job: { ...bulkJob, log: [] } });

  runBulkJob(jobs).catch((err) => {
    bulkJob.running = false;
    bulkJob.log.push(`❌ Job crashed: ${err.message}`);
  });
};


// ── Previous bulk batch cleanup ─────────────────────────────────────────────
// Matches ONLY tests created by the bulk generator (title pattern) on/after the
// first batch run, so the original hand-made / seeded tests are never touched.
const BULK_TITLE_RE = /^(Dropper|11th|12th) (Full Mock Test|Half Mock Test|Physics Subject Test|Chemistry Subject Test|Biology Subject Test|Daily Practice) \d+$/;
const BULK_SINCE = new Date("2026-10-04T16:00:00.000Z");

async function findOldBulkTests() {
  const tests = await prisma.mockTest.findMany({
    where: { createdAt: { gte: BULK_SINCE } },
    select: { id: true, title: true, classLevel: true, _count: { select: { attempts: true } } },
  });
  return tests.filter((t) => BULK_TITLE_RE.test(t.title));
}

exports.getOldBulkBatch = async (req, res) => {
  try {
    const tests = await findOldBulkTests();
    const byClass = {};
    tests.forEach((t) => { byClass[t.classLevel] = (byClass[t.classLevel] || 0) + 1; });
    res.json({
      success: true, tests: tests.length, byClass,
      testsWithAttempts: tests.filter((t) => t._count.attempts > 0).length,
      attempts: tests.reduce((n, t) => n + t._count.attempts, 0),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteOldBulkBatch = async (req, res) => {
  try {
    if (bulkJob && bulkJob.running) return res.status(409).json({ success: false, message: "A bulk build is running — wait for it to finish." });
    const tests = await findOldBulkTests();
    const ids = tests.map((t) => t.id);
    let deleted = 0, attemptsDeleted = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const a = await prisma.attempt.deleteMany({ where: { mockTestId: { in: chunk } } });
      attemptsDeleted += a.count;
      const r = await prisma.mockTest.deleteMany({ where: { id: { in: chunk } } });
      deleted += r.count;
    }
    res.json({ success: true, deleted, attemptsDeleted });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
