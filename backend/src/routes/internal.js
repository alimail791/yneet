const router = require("express").Router();
const { applyInstituteAccess } = require("../utils/instituteAccess");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Server-to-server only (Raise Academy backend), shared INTERNAL_SERVICE_KEY.
router.use((req, res, next) => {
  const key = req.headers["x-internal-key"];
  if (!process.env.INTERNAL_SERVICE_KEY || key !== process.env.INTERNAL_SERVICE_KEY) return res.status(401).json({ success: false, message: "Unauthorized" });
  next();
});

// POST /api/v1/internal/institute-access  { userId, active, endDate }
// If the student has never opened YNeet yet there is no row; the SSO bridge
// applies the plan on their first login instead.
router.post("/institute-access", async (req, res) => {
  try {
    const { userId, active, endDate } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const sub = await applyInstituteAccess(String(userId), !!active, endDate);
    res.json({ success: true, provisioned: !!sub, plan: sub?.plan || null, status: sub?.status || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/institute-progress  { userIds: [] } — summary for an institute's students
router.post("/institute-progress", async (req, res) => {
  try {
    const { institutesSummary } = require("../utils/instituteProgress");
    const ids = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    res.json({ success: true, ...(await institutesSummary(ids)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/institute-student  { userId } — one student's tests and weak chapters
router.post("/institute-student", async (req, res) => {
  try {
    const { studentDetail } = require("../utils/instituteProgress");
    if (!req.body?.userId) return res.status(400).json({ success: false, message: "userId is required" });
    res.json({ success: true, ...(await studentDetail(req.body.userId)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/allindia-results { date? } — every ranked student of an
// All-India mock (default: the latest finished Sunday). Raise Academy maps the
// students to their institutes for institute ranks and the Monday report.
router.post("/allindia-results", async (req, res) => {
  try {
    const A = require("../utils/allIndia");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date || "") ? req.body.date : A.lastFinishedSunday();
    const test = await A.findTest(date);
    const next = { date: A.thisSunday(), label: A.prettyDate(A.thisSunday()) };
    if (!test) return res.json({ success: true, date, label: A.prettyDate(date), found: false, takers: 0, rows: [], next });
    const rows = await A.rankedRows(test);
    const takers = rows.length;
    res.json({
      success: true, date, label: A.prettyDate(date), found: true, title: test.title, totalMarks: test.totalMarks, takers, next,
      rows: rows.map((r, i) => ({
        userId: r.userId, rank: i + 1, score: r.score, accuracy: Math.round(r.accuracy || 0),
        percentile: takers > 1 ? Math.round(((takers - 1 - i) / (takers - 1)) * 1000) / 10 : 100,
      })),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/trials-ending { days } — free trials (TRIAL_30D, still
// active) ending within the next `days` days (default 7), soonest first.
// Used by the Raise Academy admin dashboard's "Trials ending this week" tile.
router.post("/trials-ending", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 7, 1), 60);
    const now = new Date();
    const rows = await prisma.subscription.findMany({
      where: { plan: "TRIAL_30D", status: "active", endDate: { gt: now, lte: new Date(now.getTime() + days * 864e5) } },
      orderBy: { endDate: "asc" },
      take: 200,
      select: { userId: true, endDate: true, user: { select: { name: true, phone: true } } },
    });
    res.json({ success: true, days, trials: rows.map((r) => ({ userId: r.userId, endDate: r.endDate, name: r.user?.name || "", phone: r.user?.phone || "" })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/delete-user { userId } — Raise Academy admin deleted the student.
router.post("/delete-user", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const r = await prisma.user.deleteMany({ where: { id: userId, role: { not: "admin" } } });
    res.json({ success: true, deleted: r.count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/parent-contact { userId, parentEmail } — set by an institute.
// A new/changed email gets this week's report straight away, then weekly.
router.post("/parent-contact", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    const email = String(req.body?.parentEmail || "").trim().toLowerCase() || null;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return res.json({ success: true, provisioned: false }); // applied at first login via /auth/me
    if ((profile.parentEmail || null) === email) return res.json({ success: true, provisioned: true, changed: false });
    await prisma.profile.update({ where: { userId }, data: { parentEmail: email, lastParentDigestSent: null } });
    let sent = false;
    if (email) {
      try {
        const { buildParentReport } = require("../utils/parentReport");
        const { sendParentDigest } = require("../utils/mailer");
        await sendParentDigest(email, await buildParentReport(userId));
        await prisma.profile.update({ where: { userId }, data: { lastParentDigestSent: new Date() } });
        sent = true;
      } catch (e) { console.warn("First parent report (institute) failed:", e.message); }
    }
    res.json({ success: true, provisioned: true, changed: true, sent });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/v1/internal/parent-report { userId } — this week's numbers + WhatsApp text
router.post("/parent-report", async (req, res) => {
  try {
    const { buildParentReport, reportText } = require("../utils/parentReport");
    const stats = await buildParentReport(String(req.body?.userId || ""));
    if (!stats) return res.json({ success: true, joined: false });
    res.json({ success: true, joined: true, stats, text: reportText(stats) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ───────── Razorpay for Raise Academy institute plans ─────────
// YNeet holds the Razorpay keys; Raise Academy asks for an order and later for
// verification, so the secret never leaves this service.
let rzp = null;
const razorpay = () => {
  if (!rzp) { const Razorpay = require("razorpay"); rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }); }
  return rzp;
};

// POST /api/v1/internal/razorpay/order { amount (paise), receipt, notes }
router.post("/razorpay/order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount < 100) return res.status(400).json({ success: false, message: "Invalid amount" });
    const order = await razorpay().orders.create({
      amount, currency: "INR",
      receipt: String(req.body?.receipt || `inst_${Date.now()}`).slice(0, 40),
      notes: { ...(req.body?.notes || {}), source: "raiseacademy-institute" },
    });
    res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Institute razorpay order error:", err?.error || err.message);
    res.status(502).json({ success: false, message: "Could not start payment" });
  }
});

// POST /api/v1/internal/razorpay/verify { orderId, paymentId, signature }
// Checks the checkout signature AND asks Razorpay that this payment really is
// for this order and was paid, before anything is activated.
router.post("/razorpay/verify", async (req, res) => {
  try {
    const crypto = require("crypto");
    const { orderId, paymentId, signature } = req.body || {};
    if (!orderId || !paymentId || !signature) return res.status(400).json({ success: false, message: "Missing fields" });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const sigOk = expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
    if (!sigOk) return res.json({ success: true, valid: false, reason: "signature" });
    const payment = await razorpay().payments.fetch(paymentId);
    const paid = payment && payment.order_id === orderId && ["captured", "authorized"].includes(payment.status);
    res.json({ success: true, valid: !!paid, status: payment?.status, amount: payment?.amount, method: payment?.method, reason: paid ? null : "not paid" });
  } catch (err) {
    console.error("Institute razorpay verify error:", err?.error || err.message);
    res.status(502).json({ success: false, message: "Could not verify payment" });
  }
});

module.exports = router;
