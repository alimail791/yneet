const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { awardXP } = require("../utils/xp");
const { parseVideoLink } = require("../utils/videoLink");

const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper", "All"];

// Which Shorts a student of a given class sees. 12th students also get Class 11
// revision, and Droppers re-cover the full NEET syllabus (11 + 12) — same rule
// as utils/curriculum.js on the frontend. "All" Shorts show for every class.
function visibleClassLevels(cls) {
  if (cls === "Dropper") return ["11th", "12th", "Dropper", "All"];
  if (cls === "12th") return ["11th", "12th", "All"];
  return [cls || "12th", "All"];
}

// Never send correctOpt/explanation to the student before they answer.
const QUESTION_PUBLIC = { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true };

// ───────────────────────── Student ─────────────────────────

// GET /api/v1/shorts?subject=&language=&chapter=
// Published Shorts for the student's class: unwatched first, newest first.
exports.getFeed = async (req, res) => {
  try {
    const { subject, language, chapter } = req.query;
    const cls = req.user.profile?.class || "12th";
    const where = { isPublished: true, reviewStatus: "approved", classLevel: { in: visibleClassLevels(cls) } };
    if (subject) where.subject = subject;
    if (language) where.language = language;
    if (chapter) where.chapter = chapter;

    const [shorts, views] = await Promise.all([
      prisma.short.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { questions: { select: QUESTION_PUBLIC }, creator: { select: { youtubeUrl: true, instagramUrl: true } } },
      }),
      prisma.shortView.findMany({
        where: { userId: req.user.id },
        select: { shortId: true, quizCorrect: true, quizTotal: true, answeredIds: true },
      }),
    ]);

    const viewBy = new Map(views.map(v => [v.shortId, v]));
    const items = shorts.map(s => {
      const v = viewBy.get(s.id);
      return {
        id: s.id, title: s.title, description: s.description, subject: s.subject,
        classLevel: s.classLevel, chapter: s.chapter, language: s.language,
        provider: s.provider, videoRef: s.videoRef, durationSec: s.durationSec,
        creatorName: s.creatorName, createdAt: s.createdAt,
        creatorLinks: s.creator ? { youtube: s.creator.youtubeUrl, instagram: s.creator.instagramUrl } : null,
        questions: s.questions,
        watched: !!v,
        quiz: v ? { correct: v.quizCorrect, total: v.quizTotal, answeredIds: v.answeredIds } : null,
      };
    });
    // Stable sort keeps "newest first" inside each group.
    items.sort((a, b) => Number(a.watched) - Number(b.watched));

    // Filter chips: what actually exists for this class (ignoring the active filters).
    const facets = await prisma.short.groupBy({
      by: ["subject", "language"],
      where: { isPublished: true, reviewStatus: "approved", classLevel: { in: visibleClassLevels(cls) } },
      _count: { _all: true },
    });
    res.json({
      success: true,
      shorts: items,
      subjects: [...new Set(facets.map(f => f.subject))].sort(),
      languages: [...new Set(facets.map(f => f.language))].sort(),
      watchedCount: views.length,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/shorts/:id/view — first time a student presses play.
// Counts once per student (for creator reports) and gives a little XP.
exports.markViewed = async (req, res) => {
  try {
    const short = await prisma.short.findFirst({ where: { id: req.params.id, isPublished: true }, select: { id: true } });
    if (!short) return res.status(404).json({ success: false, message: "Short not found" });

    const existing = await prisma.shortView.findUnique({
      where: { userId_shortId: { userId: req.user.id, shortId: short.id } },
    });
    if (existing) return res.json({ success: true, firstView: false });

    try {
      await prisma.shortView.create({ data: { userId: req.user.id, shortId: short.id } });
    } catch (e) {
      // Two taps racing each other — the other request already counted it.
      if (e.code === "P2002") return res.json({ success: true, firstView: false });
      throw e;
    }
    await prisma.short.update({ where: { id: short.id }, data: { viewCount: { increment: 1 } } });
    const xp = await awardXP(req.user.id, "short_watch");
    res.json({ success: true, firstView: true, xp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/shorts/:id/answer  { questionId, selected }   (selected: 0–3)
// Checks one quick-check MCQ. Wrong answers go to the Mistake Notebook
// (source "shorts"), same as the daily quiz does.
exports.answerQuestion = async (req, res) => {
  try {
    const { questionId } = req.body;
    const selected = Number(req.body.selected);
    if (!questionId || !Number.isInteger(selected) || selected < 0 || selected > 3) {
      return res.status(400).json({ success: false, message: "questionId and selected (0–3) are required" });
    }

    const short = await prisma.short.findFirst({
      where: { id: req.params.id, isPublished: true, questions: { some: { id: questionId } } },
      select: { id: true },
    });
    if (!short) return res.status(404).json({ success: false, message: "Question is not part of this Short" });

    const q = await prisma.question.findUnique({ where: { id: questionId }, select: { correctOpt: true, explanation: true } });
    const isCorrect = selected === q.correctOpt;

    if (!isCorrect) {
      await prisma.mistake.upsert({
        where: { userId_questionId_source: { userId: req.user.id, questionId, source: "shorts" } },
        update: { count: { increment: 1 }, lastSeen: new Date() },
        create: { userId: req.user.id, questionId, source: "shorts" },
      });
    }

    // Score each question once per student; answering again just shows the solution.
    const key = { userId_shortId: { userId: req.user.id, shortId: short.id } };
    const view = await prisma.shortView.upsert({ where: key, update: {}, create: { userId: req.user.id, shortId: short.id } });
    if (!view.answeredIds.includes(questionId)) {
      await prisma.shortView.update({
        where: key,
        data: {
          answeredIds: { push: questionId },
          quizTotal: { increment: 1 },
          ...(isCorrect ? { quizCorrect: { increment: 1 } } : {}),
        },
      });
    }

    res.json({ success: true, isCorrect, correctOpt: q.correctOpt, explanation: q.explanation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────────────────────── Admin ─────────────────────────

function buildShortData(body, { partial = false } = {}) {
  const data = {};
  const errors = [];
  const str = (v) => (typeof v === "string" ? v.trim() : v);

  if (!partial || body.title !== undefined) {
    data.title = str(body.title);
    if (!data.title) errors.push("Title is required");
  }
  if (body.description !== undefined) data.description = str(body.description) || null;
  if (!partial || body.subject !== undefined) {
    data.subject = body.subject;
    if (!SUBJECTS.includes(data.subject)) errors.push("Subject must be Physics, Chemistry or Biology");
  }
  if (!partial || body.classLevel !== undefined) {
    data.classLevel = body.classLevel || "12th";
    if (!CLASS_LEVELS.includes(data.classLevel)) errors.push("Invalid class level");
  }
  if (!partial || body.chapter !== undefined) {
    data.chapter = str(body.chapter);
    if (!data.chapter) errors.push("Chapter is required");
  }
  if (body.language !== undefined || !partial) data.language = str(body.language) || "English";
  if (body.creatorName !== undefined || !partial) data.creatorName = str(body.creatorName) || "YNeet";
  if (body.isPublished !== undefined) data.isPublished = !!body.isPublished;
  if (body.isFeatured !== undefined) data.isFeatured = !!body.isFeatured;
  if (body.durationSec !== undefined) {
    const d = body.durationSec === "" || body.durationSec === null ? null : Number(body.durationSec);
    if (d !== null && (!Number.isInteger(d) || d < 0)) errors.push("Duration must be whole seconds");
    else data.durationSec = d;
  }
  if (!partial || body.videoLink !== undefined) {
    const parsed = parseVideoLink(body.videoLink);
    if (!parsed) errors.push("Video link not recognised — paste a YouTube, Bunny Stream or .mp4 link");
    else Object.assign(data, parsed);
  }
  if (body.questionIds !== undefined) {
    const ids = Array.isArray(body.questionIds) ? [...new Set(body.questionIds.filter(Boolean))] : [];
    if (ids.length > 5) errors.push("Link at most 5 questions to one Short");
    data.questions = { set: ids.map(id => ({ id })) };
  }
  return { data, errors };
}

const ADMIN_INCLUDE = {
  questions: { select: { id: true, questionText: true, chapter: true, subject: true } },
  creator: { select: { id: true, name: true, email: true, phone: true } },
  _count: { select: { views: true } },
};

// GET /api/v1/admin/shorts?subject=&classLevel=&creator=&search=
exports.adminList = async (req, res) => {
  try {
    const { subject, classLevel, creator, search, review } = req.query;
    const where = {};
    if (review) where.reviewStatus = review; // pending | approved | rejected
    if (subject) where.subject = subject;
    if (classLevel) where.classLevel = classLevel;
    if (creator) where.creatorName = creator;
    if (search) where.title = { contains: search, mode: "insensitive" };
    const shorts = await prisma.short.findMany({ where, orderBy: { createdAt: "desc" }, include: ADMIN_INCLUDE });

    // Quick-check accuracy per Short, from everyone who answered.
    const agg = await prisma.shortView.groupBy({
      by: ["shortId"],
      where: { shortId: { in: shorts.map(s => s.id) } },
      _sum: { quizCorrect: true, quizTotal: true },
    });
    const accBy = new Map(agg.map(a => [a.shortId, a._sum]));
    res.json({
      success: true,
      shorts: shorts.map(s => {
        const a = accBy.get(s.id);
        return { ...s, quizAccuracy: a?.quizTotal ? Math.round((a.quizCorrect / a.quizTotal) * 100) : null };
      }),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/admin/shorts
exports.adminCreate = async (req, res) => {
  try {
    const { data, errors } = buildShortData(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
    if (data.questions) data.questions = { connect: data.questions.set };
    data.reviewStatus = "approved";
    data.approvedAt = new Date();
    const short = await prisma.short.create({ data, include: ADMIN_INCLUDE });
    res.status(201).json({ success: true, short });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// PUT /api/v1/admin/shorts/:id  (any subset of fields)
exports.adminUpdate = async (req, res) => {
  try {
    const { data, errors } = buildShortData(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
    const short = await prisma.short.update({ where: { id: req.params.id }, data, include: ADMIN_INCLUDE });
    res.json({ success: true, short });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// DELETE /api/v1/admin/shorts/:id
exports.adminDelete = async (req, res) => {
  try {
    await prisma.short.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// Up to `count` quick-check MCQs for a chapter: PYQs first, shuffled.
async function pickQuestions({ subject, classLevel, chapter, count = 3, exclude = [] }) {
  const where = { chapter: { equals: chapter, mode: "insensitive" }, id: { notIn: exclude } };
  if (subject) where.subject = subject;
  if (classLevel && classLevel !== "All") where.classLevel = classLevel;
  const pool = await prisma.question.findMany({
    where, take: 300,
    select: { id: true, questionText: true, chapter: true, subject: true, isPYQ: true, pyqYear: true },
  });
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return { picked: [...shuffle(pool.filter(q => q.isPYQ)), ...shuffle(pool.filter(q => !q.isPYQ))].slice(0, count), poolSize: pool.length };
}

// POST /api/v1/admin/shorts/:id/review  { action: "approve" | "reject", note? }
// Approving puts a creator's Short live, fixes what they're owed for it (their
// current rate) and, if no MCQs were linked yet, auto-picks 3 from the chapter.
exports.adminReview = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ success: false, message: "action must be approve or reject" });
    const short = await prisma.short.findUnique({
      where: { id: req.params.id },
      include: { creator: true, questions: { select: { id: true } } },
    });
    if (!short) return res.status(404).json({ success: false, message: "Short not found" });

    if (action === "reject") {
      if (short.payoutId) return res.status(400).json({ success: false, message: "This Short is already in a payout" });
      const updated = await prisma.short.update({
        where: { id: short.id },
        data: { reviewStatus: "rejected", isPublished: false, reviewNote: String(note || "").trim() || null, payAmount: 0, approvedAt: null },
        include: ADMIN_INCLUDE,
      });
      return res.json({ success: true, short: updated });
    }

    const data = {
      reviewStatus: "approved", isPublished: true, reviewNote: null,
      approvedAt: short.approvedAt || new Date(),
    };
    // Keep the amount if it was approved before (e.g. re-approving after an edit).
    if (short.creator && !short.payAmount) data.payAmount = short.creator.ratePerVideo;
    if (short.creator) data.creatorName = short.creator.name;
    if (!short.questions.length) {
      const { picked } = await pickQuestions({ subject: short.subject, classLevel: short.classLevel, chapter: short.chapter });
      if (picked.length) data.questions = { connect: picked.map(q => ({ id: q.id })) };
    }
    const updated = await prisma.short.update({ where: { id: short.id }, data, include: ADMIN_INCLUDE });
    res.json({ success: true, short: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/admin/shorts/suggest-questions?subject=&classLevel=&chapter=&count=3&exclude=id1,id2
// Picks quick-check MCQs from the existing bank for the Short's chapter —
// PYQs first, then the rest, shuffled so different Shorts don't all get the same ones.
exports.suggestQuestions = async (req, res) => {
  try {
    const { subject, classLevel, chapter } = req.query;
    const count = Math.min(Math.max(Number(req.query.count) || 3, 1), 5);
    const exclude = String(req.query.exclude || "").split(",").filter(Boolean);
    if (!chapter) return res.status(400).json({ success: false, message: "Chapter is required" });
    const { picked, poolSize } = await pickQuestions({ subject, classLevel, chapter, count, exclude });
    res.json({ success: true, questions: picked, poolSize });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/admin/shorts/creators?days=7
// Per-creator report for weekly payouts: Shorts published in the period,
// plus lifetime views across all their Shorts.
exports.creatorReport = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [all, recent, recentViews] = await Promise.all([
      prisma.short.groupBy({ by: ["creatorName"], _count: { _all: true }, _sum: { viewCount: true } }),
      prisma.short.groupBy({ by: ["creatorName"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.shortView.findMany({ where: { createdAt: { gte: since } }, select: { short: { select: { creatorName: true } } } }),
    ]);
    const recentBy = new Map(recent.map(r => [r.creatorName, r._count._all]));
    const viewsBy = new Map();
    for (const v of recentViews) viewsBy.set(v.short.creatorName, (viewsBy.get(v.short.creatorName) || 0) + 1);
    const creators = all
      .map(c => ({
        creatorName: c.creatorName,
        totalShorts: c._count._all,
        totalViews: c._sum.viewCount || 0,
        shortsInPeriod: recentBy.get(c.creatorName) || 0,
        viewsInPeriod: viewsBy.get(c.creatorName) || 0,
      }))
      .sort((a, b) => b.shortsInPeriod - a.shortsInPeriod || b.totalViews - a.totalViews);
    res.json({ success: true, days, creators });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────────────────────── Public (no login) ─────────────────────────

const PUBLIC_SELECT = {
  id: true, title: true, description: true, subject: true, classLevel: true, chapter: true, language: true,
  provider: true, videoRef: true, durationSec: true, creatorName: true,
  creator: { select: { id: true, name: true, youtubeUrl: true, instagramUrl: true } },
};
const FEATURED = { isFeatured: true, isPublished: true, reviewStatus: "approved" };

// GET /api/v1/public/shorts/featured?limit=8 — for the yneet.in landing page.
exports.publicFeatured = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);
    const shorts = await prisma.short.findMany({ where: FEATURED, orderBy: { approvedAt: "desc" }, take: limit, select: PUBLIC_SELECT });
    res.set("Cache-Control", "public, max-age=300").json({ success: true, shorts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/public/shorts/:id — one featured Short for its share page (/s/:id).
exports.publicShort = async (req, res) => {
  try {
    const short = await prisma.short.findFirst({ where: { id: req.params.id, ...FEATURED }, select: PUBLIC_SELECT });
    if (!short) return res.status(404).json({ success: false, message: "This Short isn't available to share." });
    const more = await prisma.short.findMany({
      where: { ...FEATURED, id: { not: short.id } }, orderBy: { approvedAt: "desc" }, take: 6, select: PUBLIC_SELECT,
    });
    res.set("Cache-Control", "public, max-age=300").json({ success: true, short, more });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports._internal = { buildShortData, pickQuestions };
