const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const c = require("../controllers/creatorController");

// Creator accounts are separate from student SSO — email + password.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: "Too many attempts. Try again in 15 minutes." } });
router.post("/apply", authLimiter, c.apply);
router.post("/login", authLimiter, c.login);
router.post("/forgot-password", authLimiter, c.forgotPassword);
router.post("/reset-password", authLimiter, c.resetPassword);

router.use(c.creatorAuth);
router.get("/me", c.me);
router.post("/verify-email/send", authLimiter, c.sendVerifyCode);
router.post("/verify-email", authLimiter, c.verifyEmail);
router.put("/me", c.updateMe);
router.get("/shorts", c.myShorts);
router.post("/shorts", c.submitShort);
router.put("/shorts/:id", c.updateShort);
router.delete("/shorts/:id", c.deleteShort);
router.get("/payouts", c.myPayouts);

module.exports = router;
