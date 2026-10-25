const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getFeed, markViewed, answerQuestion } = require("../controllers/shortsController");

router.use(protect);
router.use(requireActiveSubscription);

router.get("/", getFeed);
router.post("/:id/view", markViewed);
router.post("/:id/answer", answerQuestion);

module.exports = router;
