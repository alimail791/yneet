const router = require("express").Router();
const { protect } = require("../middleware/auth");
const {
  getPlans,
  getMySubscription,
  createCheckout,
  verifyPayment,
} = require("../controllers/subscriptionController");

router.get("/plans", getPlans); // public — pricing page needs this before login-gated content
router.get("/me", protect, getMySubscription);
router.post("/checkout", protect, createCheckout);
router.post("/verify", protect, verifyPayment);

module.exports = router;
