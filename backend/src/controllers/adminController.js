const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ───────────────────────── Users ─────────────────────────

// GET /api/v1/admin/users
// Every YNeet-enrolled user (i.e. every student who's ever clicked the YNeet
// button and provisioned via SSO) with their class, subscription plan/dates,
// and basic activity counts — everything useful for an admin at a glance.
exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        profile: true,
        subscription: true,
        _count: { select: { attempts: true, mistakes: true } },
      },
    });

    const now = new Date();
    const shaped = users.map(u => {
      const sub = u.subscription;
      const isActive = !!(sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > now);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        gender: u.gender,
        place: u.place,
        role: u.role,
        class: u.profile?.class || null,
        targetScore: u.profile?.targetScore ?? null,
        currentScore: u.profile?.currentScore ?? null,
        joinedAt: u.createdAt,
        subscription: sub ? {
          plan: sub.plan,
          status: sub.status,
          isActive,
          startDate: sub.startDate,
          endDate: sub.endDate,
          amount: sub.amount,
        } : null,
        mockAttempts: u._count.attempts,
        mistakesLogged: u._count.mistakes,
      };
    });

    res.json({ success: true, users: shaped });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/v1/admin/users/:id/subscription — manually grant, extend, or revoke a
// plan (comping a free month, handling a refund/dispute, fixing a stuck payment).
exports.updateUserSubscription = async (req, res) => {
  try {
    const { plan, status, endDate } = req.body;
    const existing = await prisma.subscription.findUnique({ where: { userId: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "This user has no subscription record yet." });

    // Activating a plan that wasn't already active starts the clock today —
    // extending an already-active one just moves the end date, start stays put.
    const activating = status === "active" && existing.status !== "active";

    const sub = await prisma.subscription.update({
      where: { userId: req.params.id },
      data: {
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null, expiryReminderSent: false }),
        ...(activating && { startDate: new Date() }),
      },
    });
    res.json({ success: true, subscription: sub });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// PUT /api/v1/admin/users/:id/role — promote to admin / demote to student.
// An admin can't demote themselves — avoids accidentally locking yourself out
// of the panel with no other admin account to fix it from.
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["student", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "role must be 'student' or 'admin'" });
    }
    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ success: false, message: "You can't remove your own admin access." });
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ success: true, user });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// DELETE /api/v1/admin/users/:id — removes the YNeet-side account and everything
// tied to it (attempts, mistakes, subscription, etc. all cascade). Their Raise
// Academy account is untouched — they'd just get re-provisioned fresh if they
// click through to YNeet again.
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "You can't delete your own account." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// GET /api/v1/admin/users/:id — full detail view: profile, subscription, every
// mock attempt with score, for the admin to inspect one student closely.
exports.getUserDetail = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        profile: true,
        subscription: true,
        streak: true,
        xp: true,
        attempts: {
          orderBy: { createdAt: "desc" },
          include: { mockTest: { select: { title: true, totalMarks: true } } },
        },
        _count: { select: { mistakes: true } },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────────────────────── Questions ─────────────────────────

exports.listQuestions = async (req, res) => {
  try {
    const { classLevel, subject, search, isPYQ, page = 1, limit = 50 } = req.query;
    const where = {};
    if (classLevel) where.classLevel = classLevel;
    if (subject) where.subject = subject;
    if (search) where.questionText = { contains: search, mode: "insensitive" };
    if (isPYQ === "true") where.isPYQ = true;
    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: Number(limit),
        include: { mockTests: { select: { id: true, title: true } } },
      }),
      prisma.question.count({ where }),
    ]);
    res.json({ success: true, questions, total, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/admin/mocktests — for the "assign to mock test" dropdown.
// Optionally filtered by classLevel (and subject, for subject-wise tests) so the
// dropdown only shows tests that actually make sense for the question being edited.
exports.listMockTests = async (req, res) => {
  try {
    const { classLevel, subject } = req.query;
    const where = {};
    if (classLevel) where.classLevel = classLevel;
    if (subject) where.OR = [{ type: "full" }, { subject }];
    const mockTests = await prisma.mockTest.findMany({
      where, orderBy: { title: "asc" },
      select: { id: true, title: true, type: true, subject: true, classLevel: true },
    });
    res.json({ success: true, mockTests });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/admin/mocktests — create a new (initially empty) mock test.
// Questions get attached to it afterwards from the question editor's checklist.
exports.createMockTest = async (req, res) => {
  try {
    const { title, type, subject, classLevel, totalMarks, totalQs, durationMin } = req.body;
    if (!title || !type || !classLevel || !durationMin) {
      return res.status(400).json({ success: false, message: "title, type, classLevel, and durationMin are required" });
    }
    const mt = await prisma.mockTest.create({
      data: {
        title, type, classLevel,
        subject: type === "subject" ? subject : null,
        totalMarks: Number(totalMarks) || 0,
        totalQs: Number(totalQs) || 0,
        durationMin: Number(durationMin),
      },
    });
    res.status(201).json({ success: true, mockTest: mt });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateMockTest = async (req, res) => {
  try {
    const { title, type, subject, classLevel, totalMarks, totalQs, durationMin } = req.body;
    const mt = await prisma.mockTest.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(classLevel !== undefined && { classLevel }),
        ...(subject !== undefined && { subject: type === "subject" ? subject : null }),
        ...(totalMarks !== undefined && { totalMarks: Number(totalMarks) }),
        ...(totalQs !== undefined && { totalQs: Number(totalQs) }),
        ...(durationMin !== undefined && { durationMin: Number(durationMin) }),
      },
    });
    res.json({ success: true, mockTest: mt });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// DELETE /api/v1/admin/mocktests/:id — the questions themselves aren't deleted,
// just unlinked from this test (many-to-many). Past student attempts on this
// test don't cascade automatically. If any exist, this refuses unless
// ?force=true is passed, so a test with real student history can't be wiped
// by an accidental click — the frontend confirms with the attempt count first.
exports.deleteMockTest = async (req, res) => {
  try {
    const attemptCount = await prisma.attempt.count({ where: { mockTestId: req.params.id } });
    if (attemptCount > 0 && req.query.force !== "true") {
      return res.status(409).json({
        success: false,
        message: `${attemptCount} student attempt(s) exist on this test. Pass ?force=true to delete them along with the test.`,
        attemptCount,
      });
    }
    if (attemptCount > 0) await prisma.attempt.deleteMany({ where: { mockTestId: req.params.id } });
    await prisma.mockTest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// The form now sends `mockTestIds: string[]` (a question can belong to several
// tests). Prisma needs this expressed on the implicit many-to-many relation,
// and the raw array field itself must not be passed through directly.
// IMPORTANT: Prisma's nested-write type differs between create and update —
// `set` (replace the full list) is only valid on update; a nested create only
// accepts `connect`/`create`/`connectOrCreate`. Using `set` inside a
// `question.create()` throws "Unknown argument `set`". So the clause shape
// must depend on which operation is being performed.
const sanitizeQuestionPayload = (body, { isUpdate = false } = {}) => {
  const { mockTestIds, ...rest } = body;
  const ids = (mockTestIds || []).map((id) => ({ id }));
  return {
    ...rest,
    mockTests: isUpdate ? { set: ids } : { connect: ids },
  };
};

exports.createQuestion = async (req, res) => {
  try {
    const q = await prisma.question.create({ data: sanitizeQuestionPayload(req.body), include: { mockTests: true } });
    res.status(201).json({ success: true, question: q });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateQuestion = async (req, res) => {
  try {
    const q = await prisma.question.update({ where: { id: req.params.id }, data: sanitizeQuestionPayload(req.body, { isUpdate: true }), include: { mockTests: true } });
    res.json({ success: true, question: q });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// POST /api/v1/admin/questions/bulk — bulk-create questions from a CSV the
// admin uploaded (parsed to JSON on the frontend before it gets here). Each
// row is created independently so one bad row doesn't block the rest — the
// response lists exactly which rows failed and why, by row number.
// Expected fields per row: subject, chapter, topic, classLevel, difficulty,
// questionText, optionA-D, correctOpt (0-3), explanation, isPYQ, pyqYear, isRepeated.
// mockTestIds isn't supported here — bulk-uploaded questions land unassigned
// in the practice/quiz pool; assign them to specific tests afterwards from
// the question editor if needed.
exports.bulkCreateQuestions = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, message: "Body must include a non-empty 'questions' array." });
  }
  if (questions.length > 500) {
    return res.status(400).json({ success: false, message: "Max 500 questions per upload — split into smaller batches." });
  }

  const required = ["subject", "chapter", "topic", "classLevel", "questionText", "optionA", "optionB", "optionC", "optionD", "correctOpt", "explanation"];
  let skipped = 0;
  const errors = [];
  const toInsert = [];
  const truthy = (v) => v === true || String(v).toLowerCase() === "true";

  for (let i = 0; i < questions.length; i++) {
    const row = questions[i];
    const missing = required.filter((f) => row[f] === undefined || row[f] === "");
    if (missing.length) {
      errors.push({ row: i + 1, message: `Missing: ${missing.join(", ")}` });
      continue;
    }
    const correctOpt = Number(row.correctOpt);
    if (![0, 1, 2, 3].includes(correctOpt)) {
      errors.push({ row: i + 1, message: "correctOpt must be 0, 1, 2, or 3" });
      continue;
    }
    toInsert.push({
      _row: i + 1,
      data: {
        subject: row.subject,
        chapter: row.chapter,
        topic: row.topic,
        classLevel: row.classLevel,
        difficulty: row.difficulty || "medium",
        questionText: row.questionText,
        optionA: row.optionA,
        optionB: row.optionB,
        optionC: row.optionC,
        optionD: row.optionD,
        correctOpt,
        explanation: row.explanation,
        isPYQ: truthy(row.isPYQ),
        pyqYear: row.pyqYear ? Number(row.pyqYear) : null,
        isRepeated: truthy(row.isRepeated),
      },
    });
  }

  let created = 0;
  try {
    // One lookup for all PYQ duplicates (same year + same text) instead of one per row.
    const years = [...new Set(toInsert.filter((x) => x.data.isPYQ && x.data.pyqYear).map((x) => x.data.pyqYear))];
    const existing = new Set();
    if (years.length) {
      const found = await prisma.question.findMany({
        where: { isPYQ: true, pyqYear: { in: years } },
        select: { pyqYear: true, questionText: true },
      });
      found.forEach((q) => existing.add(`${q.pyqYear}|${q.questionText}`));
    }
    const fresh = [];
    for (const x of toInsert) {
      const key = `${x.data.pyqYear}|${x.data.questionText}`;
      if (x.data.isPYQ && x.data.pyqYear && existing.has(key)) { skipped++; continue; }
      existing.add(key); // also dedupes within the same batch
      fresh.push(x.data);
    }
    if (fresh.length) {
      const r = await prisma.question.createMany({ data: fresh });
      created = r.count;
    }
  } catch (err) {
    errors.push({ row: "-", message: err.message });
  }

  res.json({ success: true, created, skipped, failed: errors.length, errors });
};

// Duplicate questions = same subject + class + year + question text + all four options + answer.
// Keeps the copy used by a mock test (else the oldest) and, on remove, deletes
// only extras that no mock test uses and nothing else references (FK-protected).
async function findDuplicateGroups() {
  const all = await prisma.question.findMany({
    select: { id: true, subject: true, classLevel: true, pyqYear: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOpt: true, createdAt: true, _count: { select: { mockTests: true } } },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map();
  for (const q of all) {
    const key = [q.subject, q.classLevel, q.pyqYear ?? "", [q.questionText, q.optionA, q.optionB, q.optionC, q.optionD].map((t) => String(t).trim().replace(/\s+/g, " ").toLowerCase()).join("¦"), q.correctOpt].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const dups = [...groups.values()].filter((g) => g.length > 1);
  return { total: all.length, dups };
}

// One-off repair for rows uploaded with "True" (capital T), which the old bulk
// uploader didn't recognise: they have pyqYear set but isPYQ=false. Also tidies
// class names ("11"/"12") and difficulty casing.
async function dataFixCounts() {
  const [pyq, c11, c12, diff, sub] = await Promise.all([
    prisma.question.count({ where: { isPYQ: false, pyqYear: { not: null } } }),
    prisma.question.count({ where: { classLevel: "11" } }),
    prisma.question.count({ where: { classLevel: "12" } }),
    prisma.question.count({ where: { difficulty: { in: ["Easy", "Medium", "Hard"] } } }),
    prisma.question.count({ where: { subject: { in: ["Botany", "Zoology", "Biotechnology"] } } }),
  ]);
  return { pyqFlagMissing: pyq, class11: c11, class12: c12, difficultyCase: diff, subjectMerge: sub };
}

exports.getDataFixPreview = async (req, res) => {
  try { res.json({ success: true, ...(await dataFixCounts()) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.applyDataFix = async (req, res) => {
  try {
    const before = await dataFixCounts();
    await prisma.question.updateMany({ where: { isPYQ: false, pyqYear: { not: null } }, data: { isPYQ: true } });
    await prisma.question.updateMany({ where: { classLevel: "11" }, data: { classLevel: "11th" } });
    await prisma.question.updateMany({ where: { classLevel: "12" }, data: { classLevel: "12th" } });
    await prisma.question.updateMany({ where: { subject: { in: ["Botany", "Zoology", "Biotechnology"] } }, data: { subject: "Biology" } });
    for (const d of ["Easy", "Medium", "Hard"]) {
      await prisma.question.updateMany({ where: { difficulty: d }, data: { difficulty: d.toLowerCase() } });
    }
    const pyq = await prisma.question.count({ where: { isPYQ: true } });
    res.json({ success: true, fixed: before, pyqNow: pyq });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Near-duplicate PYQs: same year, same first 100 characters of the question
// (ignoring case/punctuation) AND the same correct-answer text. Catches the same
// paper uploaded twice with slightly different wording of the rest.
const normTxt = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
async function findNearDuplicatePyqs() {
  const all = await prisma.question.findMany({
    where: { isPYQ: true, pyqYear: { not: null } },
    select: { id: true, pyqYear: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOpt: true, explanation: true, createdAt: true, _count: { select: { mockTests: true } } },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map();
  for (const q of all) {
    const correct = [q.optionA, q.optionB, q.optionC, q.optionD][q.correctOpt] || "";
    const key = `${q.pyqYear}|${normTxt(q.questionText).slice(0, 100)}|${normTxt(correct)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  return { total: all.length, dups: [...groups.values()].filter((g) => g.length > 1) };
}

exports.getNearDuplicatePyqs = async (req, res) => {
  try {
    const { total, dups } = await findNearDuplicatePyqs();
    const extra = dups.reduce((n, g) => n + g.length - 1, 0);
    const perYear = {};
    dups.forEach((g) => { perYear[g[0].pyqYear] = (perYear[g[0].pyqYear] || 0) + g.length - 1; });
    res.json({ success: true, totalPyq: total, groups: dups.length, extraCopies: extra, perYear, remaining: total - extra,
      sample: dups.slice(0, 3).map((g) => g[0].questionText.slice(0, 90)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.removeNearDuplicatePyqs = async (req, res) => {
  try {
    const { dups } = await findNearDuplicatePyqs();
    let deleted = 0, kept = 0;
    for (const g of dups) {
      // keep the copy used in a mock test, else the one with the fullest explanation, else the oldest
      const keep = g.find((q) => q._count.mockTests > 0) ||
        [...g].sort((a, b) => String(b.explanation || "").length - String(a.explanation || "").length)[0];
      for (const q of g) {
        if (q.id === keep.id) continue;
        if (q._count.mockTests > 0) { kept++; continue; }
        try { await prisma.question.delete({ where: { id: q.id } }); deleted++; } catch { kept++; }
      }
    }
    const pyq = await prisma.question.count({ where: { isPYQ: true } });
    res.json({ success: true, deleted, leftBecauseInUse: kept, pyqNow: pyq });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getQuestionStats = async (req, res) => {
  try {
    const [total, pyq, byYear, bySubject, byClass] = await Promise.all([
      prisma.question.count(),
      prisma.question.count({ where: { isPYQ: true } }),
      prisma.question.groupBy({ by: ["pyqYear"], where: { isPYQ: true }, _count: { _all: true }, orderBy: { pyqYear: "asc" } }),
      prisma.question.groupBy({ by: ["subject"], _count: { _all: true } }),
      prisma.question.groupBy({ by: ["classLevel"], _count: { _all: true } }),
    ]);
    res.json({
      success: true, total, pyq,
      pyqByYear: byYear.map((r) => ({ year: r.pyqYear, count: r._count._all })),
      bySubject: bySubject.map((r) => ({ subject: r.subject, count: r._count._all })),
      byClass: byClass.map((r) => ({ classLevel: r.classLevel, count: r._count._all })),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDuplicateQuestions = async (req, res) => {
  try {
    const { total, dups } = await findDuplicateGroups();
    const extra = dups.reduce((n, g) => n + g.length - 1, 0);
    res.json({ success: true, total, duplicateGroups: dups.length, extraCopies: extra, uniqueAfterCleanup: total - extra });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.removeDuplicateQuestions = async (req, res) => {
  try {
    const { total, dups } = await findDuplicateGroups();
    let deleted = 0, kept = 0;
    for (const g of dups) {
      const keep = g.find((q) => q._count.mockTests > 0) || g[0];
      for (const q of g) {
        if (q.id === keep.id) continue;
        if (q._count.mockTests > 0) { kept++; continue; }
        try { await prisma.question.delete({ where: { id: q.id } }); deleted++; }
        catch { kept++; } // referenced by attempts/bookmarks etc. — leave it
      }
    }
    res.json({ success: true, totalBefore: total, deleted, leftBecauseInUse: kept });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────────────────────── Flashcards ─────────────────────────

exports.listFlashcards = async (req, res) => {
  try {
    const { classLevel, subject, search } = req.query;
    const where = {};
    if (classLevel) where.classLevel = classLevel;
    if (subject) where.subject = subject;
    if (search) where.front = { contains: search, mode: "insensitive" };
    const flashcards = await prisma.flashcard.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json({ success: true, flashcards });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createFlashcard = async (req, res) => {
  try {
    const f = await prisma.flashcard.create({ data: req.body });
    res.status(201).json({ success: true, flashcard: f });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateFlashcard = async (req, res) => {
  try {
    const f = await prisma.flashcard.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, flashcard: f });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.deleteFlashcard = async (req, res) => {
  try {
    await prisma.flashcard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ───────────────────────── Formulas ─────────────────────────

exports.listFormulas = async (req, res) => {
  try {
    const { classLevel, subject, search } = req.query;
    const where = {};
    if (classLevel) where.classLevel = classLevel;
    if (subject) where.subject = subject;
    if (search) where.title = { contains: search, mode: "insensitive" };
    const formulas = await prisma.formula.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json({ success: true, formulas });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createFormula = async (req, res) => {
  try {
    const f = await prisma.formula.create({ data: req.body });
    res.status(201).json({ success: true, formula: f });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateFormula = async (req, res) => {
  try {
    const f = await prisma.formula.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, formula: f });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.deleteFormula = async (req, res) => {
  try {
    await prisma.formula.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// ───────────────────────── Dashboard summary ─────────────────────────

exports.getSummary = async (req, res) => {
  try {
    const [totalUsers, activeSubs, totalQuestions, totalFlashcards, totalFormulas] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: "active", endDate: { gt: new Date() } } }),
      prisma.question.count(),
      prisma.flashcard.count(),
      prisma.formula.count(),
    ]);
    res.json({ success: true, summary: { totalUsers, activeSubs, totalQuestions, totalFlashcards, totalFormulas } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
