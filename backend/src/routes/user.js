const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { updateProfile, getReferralInfo } = require("../controllers/userController");
router.use(protect);
router.put("/profile", updateProfile);
router.get("/referral", getReferralInfo);
module.exports = router;
