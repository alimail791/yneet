const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getDailyQuiz, submitQuiz } = require("../controllers/quizController");
router.use(protect);
router.use(requireActiveSubscription);
router.get("/daily", getDailyQuiz);
router.post("/submit", submitQuiz);
module.exports = router;
