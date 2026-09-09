const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getMistakes } = require("../controllers/mistakeController");
router.use(protect);
router.use(requireActiveSubscription);
router.get("/", getMistakes);
module.exports = router;
