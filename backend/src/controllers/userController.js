const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.updateProfile = async (req, res) => {
  try {
    // NOTE: `class` is intentionally NOT accepted here. It's set once at
    // registration on the Raise Academy side and re-synced automatically on
    // every SSO login (see provisionFromRaiseAcademy in authController.js) —
    // letting students edit it here would break class-scoped content access.
    const { name, targetScore, currentScore, examYear, neetDate, studyHoursPerDay, weakSubjects, strongSubjects, phone, gender, place, parentEmail } = req.body;
    if (name) await prisma.user.update({ where: { id: req.user.id }, data: { name, phone, gender, place, neetDate } });
    const profile = await prisma.profile.upsert({
      where: { userId: req.user.id },
      update: { targetScore:parseInt(targetScore)||650, currentScore:parseInt(currentScore)||0, examYear:parseInt(neetDate?.split("-")[0])||2026, neetDate, studyHoursPerDay:parseFloat(studyHoursPerDay)||6, weakSubjects:weakSubjects||[], strongSubjects:strongSubjects||[], phone, gender, place, ...(parentEmail !== undefined && { parentEmail: parentEmail || null }) },
      create: { userId:req.user.id, targetScore:parseInt(targetScore)||650, examYear:2026, studyHoursPerDay:6, weakSubjects:[], strongSubjects:[], parentEmail: parentEmail || null },
    });
    res.json({ success: true, profile });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/v1/user/referral — code, shareable link, and status of every friend
// referred so far (so the student can see who's pending vs. who's qualified).
exports.getReferralInfo = async (req, res) => {
  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.user.id },
      include: { referred: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const qualifiedCount = referrals.filter(r => r.qualified).length;
    const freeMonthsEarned = referrals.filter(r => r.rewardGranted).length; // 1 qualified referral = 1 free month
    res.json({
      success: true,
      referralCode: req.user.referralCode,
      registerUrl: `${process.env.RAISE_ACADEMY_FRONTEND_URL || ""}/register?ref=${req.user.referralCode}`,
      referrals: referrals.map(r => ({ name: r.referred.name, qualified: r.qualified, rewardGranted: r.rewardGranted, joinedAt: r.createdAt })),
      qualifiedCount,
      freeMonthsEarned,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ───────── Weekly parent report ─────────
const { buildParentReport, reportText } = require("../utils/parentReport");
const { sendParentDigest } = require("../utils/mailer");
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// GET /api/v1/user/parent-report — this week's numbers + ready-to-send WhatsApp text
exports.getParentReport = async (req, res) => {
  try {
    const stats = await buildParentReport(req.user.id);
    res.json({ success: true, parentEmail: req.user.profile?.parentEmail || "", lastSent: req.user.profile?.lastParentDigestSent || null, stats, text: reportText(stats) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/v1/user/parent-email { parentEmail } — "" removes it. Sends the first report right away.
exports.setParentEmail = async (req, res) => {
  try {
    const email = String(req.body.parentEmail || "").trim().toLowerCase();
    if (email && !validEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    if (email && email === String(req.user.email).toLowerCase()) return res.status(400).json({ success: false, message: "Please enter your parent's email, not your own." });
    const before = req.user.profile?.parentEmail || "";
    await prisma.profile.update({ where: { userId: req.user.id }, data: { parentEmail: email || null, ...(email !== before && { lastParentDigestSent: null }) } });
    let sent = false;
    if (email && email !== before) {
      try {
        await sendParentDigest(email, await buildParentReport(req.user.id));
        await prisma.profile.update({ where: { userId: req.user.id }, data: { lastParentDigestSent: new Date() } });
        sent = true;
      } catch (e) { console.warn("First parent report failed:", e.message); }
    }
    res.json({ success: true, parentEmail: email, sent });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/user/parent-report/email — send now (at most once every 6 hours)
exports.emailParentReportNow = async (req, res) => {
  try {
    const email = req.user.profile?.parentEmail;
    if (!email) return res.status(400).json({ success: false, message: "Add your parent's email first." });
    const last = req.user.profile?.lastParentDigestSent;
    if (last && Date.now() - new Date(last).getTime() < 6 * 60 * 60 * 1000) return res.status(429).json({ success: false, message: "A report was sent recently. You can send another in a few hours." });
    await sendParentDigest(email, await buildParentReport(req.user.id));
    await prisma.profile.update({ where: { userId: req.user.id }, data: { lastParentDigestSent: new Date() } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
