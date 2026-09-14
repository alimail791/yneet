const router = require("express").Router();
const { protect, requireAdmin } = require("../middleware/auth");
const c = require("../controllers/adminController");

router.use(protect);
router.use(requireAdmin);

router.get("/summary", c.getSummary);

router.get("/users", c.listUsers);
router.get("/users/:id", c.getUserDetail);
router.put("/users/:id/subscription", c.updateUserSubscription);
router.put("/users/:id/role", c.updateUserRole);
router.delete("/users/:id", c.deleteUser);

router.get("/mocktests", c.listMockTests);
router.post("/mocktests", c.createMockTest);
router.put("/mocktests/:id", c.updateMockTest);
router.delete("/mocktests/:id", c.deleteMockTest);

router.get("/questions", c.listQuestions);
router.post("/questions", c.createQuestion);
router.post("/questions/bulk", c.bulkCreateQuestions);
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
