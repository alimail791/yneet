const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");
const { _internal: { buildShortData } } = require("./shortsController");
const { sendCreatorCode, sendCreatorSignupAlert } = require("../utils/mailer");

// ───────── Email codes (verify email / reset password) ─────────
const VERIFY_CUTOFF = new Date("2026-10-26T09:00:00Z"); // accounts older than this count as verified
const isVerified = (c) => !!c.emailVerifiedAt || new Date(c.createdAt) < VERIFY_CUTOFF;
const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const CODE_MS = 15 * 60 * 1000;
const RESEND_GAP_MS = 45 * 1000;
async function issueCode(creator, purpose) {
  // Same purpose asked again within 45 s → keep the code already sent.
  const issuedAt = creator.codeExpires ? new Date(creator.codeExpires).getTime() - CODE_MS : 0;
  if (creator.codePurpose === purpose && Date.now() - issuedAt < RESEND_GAP_MS) return { throttled: true };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await prisma.creator.update({ where: { id: creator.id }, data: { codeHash: hashCode(code), codePurpose: purpose, codeExpires: new Date(Date.now() + CODE_MS), codeTries: 0 } });
  await sendCreatorCode(creator, code, purpose);
  return { sent: true };
}
// Checks a code; on success clears it. Returns an error message or null.
async function useCode(creator, purpose, code) {
  if (!creator || creator.codePurpose !== purpose || !creator.codeHash) return "Ask for a new code first.";
  if (new Date(creator.codeExpires) < new Date()) return "This code has expired. Ask for a new one.";
  if (creator.codeTries >= 5) return "Too many wrong tries. Ask for a new code.";
  const ok = crypto.timingSafeEqual(Buffer.from(hashCode(String(code || "").trim())), Buffer.from(creator.codeHash));
  if (!ok) {
    await prisma.creator.update({ where: { id: creator.id }, data: { codeTries: { increment: 1 } } });
    return "That code is not right. Check the email and try again.";
  }
  await prisma.creator.update({ where: { id: creator.id }, data: { codeHash: null, codePurpose: null, codeExpires: null, codeTries: 0 } });
  return null;
}

// Creator sessions use their own signing secret, so a creator token can never
// pass the student `protect` middleware (and vice versa).
const CREATOR_SECRET = () => process.env.CREATOR_JWT_SECRET || `${process.env.JWT_SECRET}::creator`;
const signCreator = (c) => jwt.sign({ cid: c.id, typ: "creator" }, CREATOR_SECRET(), { expiresIn: "30d" });

const clean = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map(x => clean(String(x), 40)).filter(Boolean).slice(0, 10);
const httpsUrl = (v) => {
  const s = clean(v, 300);
  if (!s) return null;
  try { const u = new URL(s.startsWith("http") ? s : `https://${s}`); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
};
const phone10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

function creatorView(c) {
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, bio: c.bio,
    youtubeUrl: c.youtubeUrl, instagramUrl: c.instagramUrl, subjects: c.subjects, languages: c.languages,
    upiId: c.upiId, ratePerVideo: c.ratePerVideo, status: c.status, createdAt: c.createdAt,
    emailVerified: isVerified(c),
  };
}

// ───────────────────────── Middleware ─────────────────────────

exports.creatorAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Please log in" });
    const decoded = jwt.verify(token, CREATOR_SECRET());
    if (decoded.typ !== "creator") throw new Error("wrong token");
    const creator = await prisma.creator.findUnique({ where: { id: decoded.cid } });
    if (!creator) return res.status(401).json({ success: false, message: "Account not found" });
    if (creator.status === "suspended") return res.status(403).json({ success: false, message: "Your creator account is suspended. Contact YNeet." });
    req.creator = creator;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Session expired — please log in again" });
  }
};

const requireApproved = (req, res) => {
  if (!isVerified(req.creator)) {
    res.status(403).json({ success: false, message: "Please confirm your email first — enter the code we sent you." });
    return false;
  }
  if (req.creator.status !== "approved") {
    res.status(403).json({ success: false, message: "Your account is waiting for approval. You can submit Shorts once YNeet approves it." });
    return false;
  }
  return true;
};

// ───────────────────────── Account ─────────────────────────

// POST /api/v1/creator/apply
exports.apply = async (req, res) => {
  try {
    const name = clean(req.body.name, 80);
    const email = clean(req.body.email, 120).toLowerCase();
    const phone = phone10(req.body.phone);
    const password = String(req.body.password || "");
    const errors = [];
    if (!name) errors.push("Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email");
    if (phone.length !== 10) errors.push("Enter a 10-digit WhatsApp number");
    if (password.length < 8) errors.push("Password must be at least 8 characters");
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });

    const exists = await prisma.creator.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, message: "An account with this email already exists — log in instead." });

    const creator = await prisma.creator.create({
      data: {
        name, email, phone,
        passwordHash: await bcrypt.hash(password, 10),
        bio: clean(req.body.bio, 600) || null,
        youtubeUrl: httpsUrl(req.body.youtubeUrl),
        instagramUrl: httpsUrl(req.body.instagramUrl),
        subjects: list(req.body.subjects),
        languages: list(req.body.languages),
        upiId: clean(req.body.upiId, 80) || null,
      },
    });
    // Email problems must not lose the sign-up: the creator can ask for the code again.
    let codeSent = true;
    try { await issueCode(creator, "verify"); } catch (e) { codeSent = false; console.error("creator verify email failed:", e.message); }
    sendCreatorSignupAlert(creator).catch((e) => console.error("creator signup alert failed:", e.message));
    res.status(201).json({ success: true, token: signCreator(creator), creator: creatorView(creator), codeSent });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/creator/verify-email/send  (logged in) — send or resend the code
exports.sendVerifyCode = async (req, res) => {
  try {
    if (isVerified(req.creator)) return res.json({ success: true, alreadyVerified: true });
    const r = await issueCode(req.creator, "verify");
    res.json({ success: true, message: r.throttled ? "A code was just sent. Wait a minute before asking again." : `Code sent to ${req.creator.email}` });
  } catch (err) { res.status(500).json({ success: false, message: "Couldn't send the email. Try again in a minute." }); }
};

// POST /api/v1/creator/verify-email  (logged in) { code }
exports.verifyEmail = async (req, res) => {
  try {
    if (isVerified(req.creator)) return res.json({ success: true, creator: creatorView(req.creator) });
    const fresh = await prisma.creator.findUnique({ where: { id: req.creator.id } });
    const error = await useCode(fresh, "verify", req.body.code);
    if (error) return res.status(400).json({ success: false, message: error });
    const creator = await prisma.creator.update({ where: { id: fresh.id }, data: { emailVerifiedAt: new Date() } });
    res.json({ success: true, creator: creatorView(creator) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/creator/forgot-password { email } — always answers the same way,
// so it can't be used to find out which emails have accounts.
exports.forgotPassword = async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  try {
    const creator = email && (await prisma.creator.findUnique({ where: { email } }));
    if (creator && creator.status !== "suspended") await issueCode(creator, "reset");
  } catch (err) { console.error("creator reset email failed:", err.message); }
  res.json({ success: true, message: "If that email has a creator account, we've sent a 6-digit code to it." });
};

// POST /api/v1/creator/reset-password { email, code, password }
exports.resetPassword = async (req, res) => {
  try {
    const email = clean(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    const creator = email && (await prisma.creator.findUnique({ where: { email } }));
    const error = await useCode(creator, "reset", req.body.code);
    if (error) return res.status(400).json({ success: false, message: error });
    // The code arrived by email, so this also proves the email address.
    const updated = await prisma.creator.update({
      where: { id: creator.id },
      data: { passwordHash: await bcrypt.hash(password, 10), emailVerifiedAt: creator.emailVerifiedAt || new Date() },
    });
    if (updated.status === "suspended") return res.status(403).json({ success: false, message: "Your creator account is suspended. Contact YNeet." });
    res.json({ success: true, token: signCreator(updated), creator: creatorView(updated) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/creator/login  { email, password }
exports.login = async (req, res) => {
  try {
    const email = clean(req.body.email, 120).toLowerCase();
    const creator = await prisma.creator.findUnique({ where: { email } });
    const ok = creator && (await bcrypt.compare(String(req.body.password || ""), creator.passwordHash));
    if (!ok) return res.status(401).json({ success: false, message: "Wrong email or password" });
    if (creator.status === "suspended") return res.status(403).json({ success: false, message: "Your creator account is suspended. Contact YNeet." });
    res.json({ success: true, token: signCreator(creator), creator: creatorView(creator) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/creator/me — profile plus headline numbers for the dashboard.
exports.me = async (req, res) => {
  try {
    const c = req.creator;
    const [counts, viewsAgg, unpaid, paidAgg] = await Promise.all([
      prisma.short.groupBy({ by: ["reviewStatus"], where: { creatorId: c.id }, _count: { _all: true } }),
      prisma.short.aggregate({ where: { creatorId: c.id }, _sum: { viewCount: true } }),
      prisma.short.aggregate({ where: { creatorId: c.id, reviewStatus: "approved", payoutId: null }, _sum: { payAmount: true }, _count: { _all: true } }),
      prisma.creatorPayout.aggregate({ where: { creatorId: c.id, status: "paid" }, _sum: { amount: true, bonus: true } }),
    ]);
    const by = Object.fromEntries(counts.map(x => [x.reviewStatus, x._count._all]));
    res.json({
      success: true,
      creator: creatorView(c),
      stats: {
        approved: by.approved || 0, pending: by.pending || 0, rejected: by.rejected || 0,
        viewers: viewsAgg._sum.viewCount || 0,
        unpaidShorts: unpaid._count._all, unpaidAmount: unpaid._sum.payAmount || 0,
        paidTotal: (paidAgg._sum.amount || 0) + (paidAgg._sum.bonus || 0),
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/v1/creator/me — profile, payout details, optional password change.
exports.updateMe = async (req, res) => {
  try {
    const b = req.body;
    const data = {};
    if (b.name !== undefined) { data.name = clean(b.name, 80); if (!data.name) return res.status(400).json({ success: false, message: "Name is required" }); }
    if (b.phone !== undefined) { data.phone = phone10(b.phone); if (data.phone.length !== 10) return res.status(400).json({ success: false, message: "Enter a 10-digit WhatsApp number" }); }
    if (b.bio !== undefined) data.bio = clean(b.bio, 600) || null;
    if (b.youtubeUrl !== undefined) data.youtubeUrl = httpsUrl(b.youtubeUrl);
    if (b.instagramUrl !== undefined) data.instagramUrl = httpsUrl(b.instagramUrl);
    if (b.subjects !== undefined) data.subjects = list(b.subjects);
    if (b.languages !== undefined) data.languages = list(b.languages);
    if (b.upiId !== undefined) data.upiId = clean(b.upiId, 80) || null;
    if (b.newPassword) {
      if (String(b.newPassword).length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
      if (!(await bcrypt.compare(String(b.currentPassword || ""), req.creator.passwordHash))) return res.status(400).json({ success: false, message: "Current password is wrong" });
      data.passwordHash = await bcrypt.hash(String(b.newPassword), 10);
    }
    const creator = await prisma.creator.update({ where: { id: req.creator.id }, data });
    // Keep the on-screen credit in step with a name change.
    if (data.name) await prisma.short.updateMany({ where: { creatorId: creator.id }, data: { creatorName: data.name } });
    res.json({ success: true, creator: creatorView(creator) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────────────────────── Shorts ─────────────────────────

const CREATOR_FIELDS = ["title", "description", "subject", "classLevel", "chapter", "language", "videoLink", "durationSec"];
const pick = (body) => Object.fromEntries(CREATOR_FIELDS.filter(k => body[k] !== undefined).map(k => [k, body[k]]));

// GET /api/v1/creator/shorts
exports.myShorts = async (req, res) => {
  try {
    const shorts = await prisma.short.findMany({
      where: { creatorId: req.creator.id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true, title: true, description: true, subject: true, classLevel: true, chapter: true, language: true,
        provider: true, videoRef: true, durationSec: true, reviewStatus: true, reviewNote: true,
        submittedAt: true, approvedAt: true, viewCount: true, payAmount: true, isFeatured: true,
        payout: { select: { status: true, paidAt: true } },
      },
    });
    res.json({ success: true, shorts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/creator/shorts — submit a new Short for review.
exports.submitShort = async (req, res) => {
  try {
    if (!requireApproved(req, res)) return;
    const { data, errors } = buildShortData(pick(req.body));
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
    const short = await prisma.short.create({
      data: {
        ...data,
        creatorId: req.creator.id, creatorName: req.creator.name,
        reviewStatus: "pending", isPublished: false, submittedAt: new Date(),
      },
    });
    res.status(201).json({ success: true, short });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// PUT /api/v1/creator/shorts/:id — fix a pending or rejected Short (goes back to review).
exports.updateShort = async (req, res) => {
  try {
    if (!requireApproved(req, res)) return;
    const existing = await prisma.short.findFirst({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Short not found" });
    if (existing.reviewStatus === "approved") return res.status(400).json({ success: false, message: "Approved Shorts can't be edited. Message YNeet if something needs fixing." });
    const { data, errors } = buildShortData(pick(req.body), { partial: true });
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
    const short = await prisma.short.update({
      where: { id: existing.id },
      data: { ...data, reviewStatus: "pending", reviewNote: null, isPublished: false, submittedAt: new Date() },
    });
    res.json({ success: true, short });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// DELETE /api/v1/creator/shorts/:id — withdraw a pending or rejected Short.
exports.deleteShort = async (req, res) => {
  try {
    const existing = await prisma.short.findFirst({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Short not found" });
    if (existing.reviewStatus === "approved") return res.status(400).json({ success: false, message: "Approved Shorts can't be deleted." });
    await prisma.short.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// GET /api/v1/creator/payouts — weekly settlements, newest first.
exports.myPayouts = async (req, res) => {
  try {
    const payouts = await prisma.creatorPayout.findMany({
      where: { creatorId: req.creator.id }, orderBy: { periodEnd: "desc" }, take: 52,
      select: { id: true, periodStart: true, periodEnd: true, videoCount: true, amount: true, bonus: true, status: true, paidAt: true, reference: true },
    });
    res.json({ success: true, payouts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports._internal = { creatorView, signCreator, CREATOR_SECRET };
