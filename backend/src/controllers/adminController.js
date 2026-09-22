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
    const { classLevel, subject, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (classLevel) where.classLevel = classLevel;
    if (subject) where.subject = subject;
    if (search) where.questionText = { contains: search, mode: "insensitive" };
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
// tests). Prisma needs this expressed as a `set` on the implicit many-to-many
// relation, and the raw array field itself must not be passed through directly.
const sanitizeQuestionPayload = (body) => {
  const { mockTestIds, ...rest } = body;
  return {
    ...rest,
    mockTests: { set: (mockTestIds || []).map((id) => ({ id })) },
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
    const q = await prisma.question.update({ where: { id: req.params.id }, data: sanitizeQuestionPayload(req.body), include: { mockTests: true } });
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
  let created = 0;
  const errors = [];

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
    try {
      await prisma.question.create({
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
          isPYQ: row.isPYQ === true || row.isPYQ === "true" || row.isPYQ === "TRUE",
          pyqYear: row.pyqYear ? Number(row.pyqYear) : null,
          isRepeated: row.isRepeated === true || row.isRepeated === "true" || row.isRepeated === "TRUE",
        },
      });
      created++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message });
    }
  }

  res.json({ success: true, created, failed: errors.length, errors });
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
