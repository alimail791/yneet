// Student verification after sign-up: WhatsApp OTP (delivered through Raise
// Academy's WhatsApp Business number) or an email link. Either one sets
// User.isVerified, which lifts the 3-day pause on the free trial.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendVerifyEmail } = require("../utils/mailer");
const { verificationState } = require("../utils/verification");

const CODE_TTL = 10 * 60 * 1000;
const RESEND_GAP = 45 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_TRIES = 5;

// One instance serves YNeet, so pending codes can live in memory; a restart
// only means the student taps "Send code" again.
const pending = new Map(); // userId -> { hash, phone, exp, tries, sends: [timestamps] }
const hash = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

const phone10 = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
};

const deliverWhatsApp = async (phone, code) => {
  const base = process.env.RAISE_ACADEMY_API_URL;
  if (!base || !process.env.INTERNAL_SERVICE_KEY) throw new Error("WhatsApp delivery is not configured");
  await axios.post(`${base}/auth/internal/wa-otp`, { phone, code }, {
    headers: { "X-Internal-Key": process.env.INTERNAL_SERVICE_KEY }, timeout: 20000,
  });
};

const markVerified = async (userId, data = {}) =>
  prisma.user.update({ where: { id: userId }, data: { isVerified: true, ...data } });

// GET /api/v1/user/verify — current state (for the banner / verify page)
exports.status = async (req, res) => {
  res.json({ success: true, verification: verificationState(req.user), phone: req.user.phone || "", email: req.user.email });
};

// POST /api/v1/user/verify/whatsapp/send { phone }
exports.sendWhatsApp = async (req, res) => {
  if (req.user.isVerified) return res.json({ success: true, alreadyVerified: true });
  const phone = phone10(req.body?.phone || req.user.phone);
  if (!phone) return res.status(400).json({ success: false, message: "Enter your 10-digit WhatsApp number" });
  const now = Date.now();
  const p = pending.get(req.user.id) || { sends: [] };
  p.sends = (p.sends || []).filter((t) => now - t < 60 * 60 * 1000);
  if (p.sends.length && now - p.sends[p.sends.length - 1] < RESEND_GAP) {
    return res.status(429).json({ success: false, message: "Please wait a few seconds before asking for a new code." });
  }
  if (p.sends.length >= MAX_SENDS_PER_HOUR) {
    return res.status(429).json({ success: false, message: "Too many codes requested. Try again in an hour, or confirm by email instead." });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  try {
    await deliverWhatsApp(phone, code);
  } catch (e) {
    console.warn("WhatsApp OTP delivery failed:", e.response?.data?.message || e.message);
    return res.status(502).json({ success: false, message: "Couldn't send the WhatsApp code right now. Please confirm by email instead." });
  }
  pending.set(req.user.id, { hash: hash(code), phone, exp: now + CODE_TTL, tries: 0, sends: [...p.sends, now] });
  res.json({ success: true, sentTo: `+91 ${phone.slice(0, 2)}xxxxxx${phone.slice(-2)}` });
};

// POST /api/v1/user/verify/whatsapp/confirm { code }
exports.confirmWhatsApp = async (req, res) => {
  if (req.user.isVerified) return res.json({ success: true, alreadyVerified: true });
  const p = pending.get(req.user.id);
  if (!p || !p.hash || Date.now() > p.exp) return res.status(400).json({ success: false, message: "Code expired. Tap “Send code” again." });
  if (p.tries >= MAX_TRIES) return res.status(429).json({ success: false, message: "Too many wrong attempts. Ask for a new code." });
  if (hash(String(req.body?.code || "").trim()) !== p.hash) {
    p.tries += 1;
    return res.status(400).json({ success: false, message: "That code isn't right. Check WhatsApp and try again." });
  }
  pending.delete(req.user.id);
  await markVerified(req.user.id, { phone: p.phone });
  res.json({ success: true, verified: true });
};

// POST /api/v1/user/verify/email/send
exports.sendEmailLink = async (req, res) => {
  if (req.user.isVerified) return res.json({ success: true, alreadyVerified: true });
  const token = jwt.sign({ uid: req.user.id, purpose: "verify-email" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  const base = (process.env.FRONTEND_URL || "https://app.yneet.in").replace(/\/$/, "");
  try {
    await sendVerifyEmail(req.user, `${base}/verify-email?token=${encodeURIComponent(token)}`);
    res.json({ success: true, sentTo: req.user.email });
  } catch (e) {
    console.warn("Verify email failed:", e.message);
    res.status(502).json({ success: false, message: "Couldn't send the email right now. Try WhatsApp instead." });
  }
};

// POST /api/v1/public/verify-email { token } — no login needed (opened from the email)
exports.confirmEmail = async (req, res) => {
  try {
    const data = jwt.verify(String(req.body?.token || ""), process.env.JWT_SECRET);
    if (data.purpose !== "verify-email" || !data.uid) throw new Error("bad token");
    await markVerified(data.uid);
    res.json({ success: true, verified: true });
  } catch {
    res.status(400).json({ success: false, message: "This link has expired or isn't valid. Open YNeet and ask for a new one." });
  }
};

exports._internal = { pending, phone10 };
