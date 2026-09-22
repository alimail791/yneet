const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getLeaderboard } = require("../controllers/leaderboardController");
router.use(protect);
router.use(requireActiveSubscription);
router.get("/", getLeaderboard);
module.exports = router;
