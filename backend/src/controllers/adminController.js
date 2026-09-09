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
        include: { mockTest: { select: { id: true, title: true } } },
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

// A blank "" from a <select> means "no mock test assigned" — Prisma needs that as
// null, not an empty string, since mockTestId is a nullable foreign key.
const sanitizeQuestionPayload = (body) => ({
  ...body,
  mockTestId: body.mockTestId || null,
});

exports.createQuestion = async (req, res) => {
  try {
    const q = await prisma.question.create({ data: sanitizeQuestionPayload(req.body) });
    res.status(201).json({ success: true, question: q });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateQuestion = async (req, res) => {
  try {
    const q = await prisma.question.update({ where: { id: req.params.id }, data: sanitizeQuestionPayload(req.body) });
    res.json({ success: true, question: q });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
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
