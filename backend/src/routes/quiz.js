const router = require("express").Router();
const { protect, requireActiveSubscriptionOrJunior } = require("../middleware/auth");
const { getDailyQuiz, submitQuiz } = require("../controllers/quizController");
router.use(protect);
// Free for Class 6–8 too (see middleware/auth.js).
router.use(requireActiveSubscriptionOrJunior);
router.get("/daily", getDailyQuiz);
router.post("/submit", submitQuiz);
module.exports = router;
