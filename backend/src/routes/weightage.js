const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getMap, createPlan, toggleTask } = require("../controllers/weightageController");
router.use(protect);
router.use(requireActiveSubscription);
router.get("/map", getMap);
router.post("/plan", createPlan);
router.post("/plan/task", toggleTask);
module.exports = router;
