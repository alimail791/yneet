const router = require("express").Router();
const { protect, requireActiveSubscriptionOrFreeDaily } = require("../middleware/auth");
const { listTests, startTest, resumeAttempt, saveResponse, submitTest, getAnalysis } = require("../controllers/mockController");
router.use(protect);
// Class 6–8 (free tier) can take their class tests too; Class 9+ without a
// plan get one free Daily/Chapter test a day (see middleware/auth.js).
router.use(requireActiveSubscriptionOrFreeDaily);
router.get("/", listTests);
router.post("/:testId/start", startTest);
router.get("/:attemptId/resume", resumeAttempt);
router.post("/:attemptId/response", saveResponse);
router.post("/:attemptId/submit", submitTest);
router.get("/:attemptId/analysis", getAnalysis);
module.exports = router;
