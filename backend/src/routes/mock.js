const router = require("express").Router();
const { protect, requireActiveSubscriptionOrJunior } = require("../middleware/auth");
const { listTests, startTest, saveResponse, submitTest, getAnalysis } = require("../controllers/mockController");
router.use(protect);
// Class 6–8 (free tier) can take their class tests too.
router.use(requireActiveSubscriptionOrJunior);
router.get("/", listTests);
router.post("/:testId/start", startTest);
router.post("/:attemptId/response", saveResponse);
router.post("/:attemptId/submit", submitTest);
router.get("/:attemptId/analysis", getAnalysis);
module.exports = router;
