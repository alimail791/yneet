const router = require("express").Router();
const { bridge, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// SSO handoff from Raise Academy — the only way a session starts on YNeet now.
router.post("/bridge", bridge);
router.get("/me", protect, getMe);

module.exports = router;
