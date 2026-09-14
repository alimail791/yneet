const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { explainDifferently } = require("../controllers/aiController");

router.use(protect);
router.use(requireActiveSubscription);

router.post("/explain/:questionId", explainDifferently);

module.exports = router;
