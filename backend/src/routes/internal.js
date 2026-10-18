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

module.exports = router;
