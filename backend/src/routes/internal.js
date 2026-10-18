const router = require("express").Router();
const { applyInstituteAccess } = require("../utils/instituteAccess");

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

module.exports = router;
