const { PrismaClient } = require("@prisma/client");
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
