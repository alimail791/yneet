const router = require("express").Router();
const { protect, requireAdmin } = require("../middleware/auth");
const c = require("../controllers/adminController");

router.use(protect);
router.use(requireAdmin);

router.get("/summary", c.getSummary);

router.get("/users", c.listUsers);

router.get("/mocktests", c.listMockTests);

router.get("/questions", c.listQuestions);
router.post("/questions", c.createQuestion);
router.put("/questions/:id", c.updateQuestion);
router.delete("/questions/:id", c.deleteQuestion);

router.get("/flashcards", c.listFlashcards);
router.post("/flashcards", c.createFlashcard);
router.put("/flashcards/:id", c.updateFlashcard);
router.delete("/flashcards/:id", c.deleteFlashcard);

router.get("/formulas", c.listFormulas);
router.post("/formulas", c.createFormula);
router.put("/formulas/:id", c.updateFormula);
router.delete("/formulas/:id", c.deleteFormula);

module.exports = router;
