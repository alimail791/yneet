const router = require("express").Router();
const { protect, requireActiveSubscriptionOrJunior } = require("../middleware/auth");
const { getFeed, markViewed, answerQuestion } = require("../controllers/shortsController");

router.use(protect);
// Free for Class 6–8 too (see middleware/auth.js).
router.use(requireActiveSubscriptionOrJunior);

router.get("/", getFeed);
router.post("/:id/view", markViewed);
router.post("/:id/answer", answerQuestion);

module.exports = router;
