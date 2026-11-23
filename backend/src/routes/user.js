const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { updateProfile, getReferralInfo, getParentReport, setParentEmail, emailParentReportNow, moveToNextClass, getParentPhone, setParentPhone } = require("../controllers/userController");
router.use(protect);
router.put("/profile", updateProfile);
router.get("/referral", getReferralInfo);
// Share taps from the app (Refer & Earn, Challenge a friend) for the admin Growth screen.
router.post("/track", (req, res) => {
  const kind = String(req.body?.kind || "");
  if (["invite_share", "challenge_share"].includes(kind)) require("../utils/growth").logEvent(kind, req.user.id, req.body?.ref);
  res.status(204).end();
});
router.get("/parent-report", getParentReport);
router.put("/parent-email", setParentEmail);
router.post("/parent-report/email", emailParentReportNow);
router.post("/next-class", moveToNextClass);
router.get("/parent-phone", getParentPhone);
router.put("/parent-phone", setParentPhone);
const verify = require("../controllers/verifyController");
router.get("/verify", verify.status);
router.post("/verify/whatsapp/send", verify.sendWhatsApp);
router.post("/verify/whatsapp/confirm", verify.confirmWhatsApp);
router.post("/verify/email/send", verify.sendEmailLink);
module.exports = router;
