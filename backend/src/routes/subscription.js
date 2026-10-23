const router = require("express").Router();
const { protect, optionalAuth } = require("../middleware/auth");
const {
  getPlans,
  getMySubscription,
  createCheckout,
  verifyPayment,
  startTrial,
} = require("../controllers/subscriptionController");

router.get("/plans", optionalAuth, getPlans); // public — pricing page needs this before login-gated content; optionalAuth personalises MONTHLY price by class when logged in
router.get("/me", protect, getMySubscription);
router.post("/start-trial", protect, startTrial);
router.post("/checkout", protect, createCheckout);
router.post("/verify", protect, verifyPayment);

module.exports = router;
