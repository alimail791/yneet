const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getDashboard } = require("../controllers/dashboardController");
router.use(protect);
router.use(requireActiveSubscription);
router.get("/", getDashboard);
module.exports = router;
