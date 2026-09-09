const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { getFlashcards, getFormulas } = require("../controllers/contentController");

router.use(protect);
router.use(requireActiveSubscription);

router.get("/flashcards", getFlashcards);
router.get("/formulas", getFormulas);

module.exports = router;
