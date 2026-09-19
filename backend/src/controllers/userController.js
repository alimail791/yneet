const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.updateProfile = async (req, res) => {
  try {
    // NOTE: `class` is intentionally NOT accepted here. It's set once at
    // registration on the Raise Academy side and re-synced automatically on
    // every SSO login (see provisionFromRaiseAcademy in authController.js) —
    // letting students edit it here would break class-scoped content access.
    const { name, targetScore, currentScore, examYear, neetDate, studyHoursPerDay, weakSubjects, strongSubjects, phone, gender, place } = req.body;
    if (name) await prisma.user.update({ where: { id: req.user.id }, data: { name, phone, gender, place, neetDate } });
    const profile = await prisma.profile.upsert({
      where: { userId: req.user.id },
      update: { targetScore:parseInt(targetScore)||650, currentScore:parseInt(currentScore)||0, examYear:parseInt(neetDate?.split("-")[0])||2026, neetDate, studyHoursPerDay:parseFloat(studyHoursPerDay)||6, weakSubjects:weakSubjects||[], strongSubjects:strongSubjects||[], phone, gender, place },
      create: { userId:req.user.id, targetScore:parseInt(targetScore)||650, examYear:2026, studyHoursPerDay:6, weakSubjects:[], strongSubjects:[] },
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
