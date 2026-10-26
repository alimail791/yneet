const router = require("express").Router();
const { protect, requireAdmin } = require("../middleware/auth");
const c = require("../controllers/adminController");
const { generateContent, extractQuestionsFromImage } = require("../controllers/aiController");
const { getContentCoverage } = require("../controllers/contentCoverageController");
const ct = require("../controllers/chapterTestController");
const sh = require("../controllers/shortsController");
const { getPoolStats, buildMockTest, startBulkBuild, getBulkStatus, getOldBulkBatch, deleteOldBulkBatch, importSchoolQuestions } = require("../controllers/mockBuilderController");

router.use(protect);
router.use(requireAdmin);

router.post("/ai/generate", generateContent);
router.post("/ai/extract-questions", extractQuestionsFromImage);

router.get("/content-coverage", getContentCoverage);
router.get("/mock-builder/pool-stats", getPoolStats);
router.post("/mock-builder/build", buildMockTest);
router.post("/mock-builder/bulk-build", startBulkBuild);
router.get("/mock-builder/bulk-status", getBulkStatus);
router.get("/mock-builder/old-batch", getOldBulkBatch);
router.post("/mock-builder/old-batch/delete", deleteOldBulkBatch);
router.post("/mock-builder/school-questions/import", importSchoolQuestions);
router.get("/mock-builder/chapter-tests/preview", ct.previewChapterTests);
router.post("/mock-builder/chapter-tests/build", ct.startChapterBuild);
router.get("/mock-builder/chapter-tests/status", ct.getChapterBuildStatus);
router.post("/mock-builder/chapter-tests/delete", ct.deleteChapterTests);

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
router.get("/questions/fix-data", c.getDataFixPreview);
router.post("/questions/fix-data", c.applyDataFix);
router.get("/questions/near-duplicate-pyqs", c.getNearDuplicatePyqs);
router.post("/questions/near-duplicate-pyqs/remove", c.removeNearDuplicatePyqs);
router.get("/questions/pyq-audit", c.getPyqAudit);
router.get("/questions/pyq-audit.csv", c.exportPyqAuditCsv);
router.post("/questions/pyq-audit/remove-duplicates", c.removePyqLooseDuplicates);
router.get("/questions/stats", c.getQuestionStats);
router.get("/questions/export.csv", c.exportQuestionsCsv);
router.get("/questions/duplicates", c.getDuplicateQuestions);
router.post("/questions/duplicates/remove", c.removeDuplicateQuestions);
router.put("/questions/:id", c.updateQuestion);
router.delete("/questions/:id", c.deleteQuestion);

router.get("/flashcards", c.listFlashcards);
router.post("/flashcards", c.createFlashcard);
router.put("/flashcards/:id", c.updateFlashcard);
router.delete("/flashcards/:id", c.deleteFlashcard);

// Shorts — fixed paths before "/shorts/:id"
router.get("/shorts/suggest-questions", sh.suggestQuestions);
router.get("/shorts/creators", sh.creatorReport);
router.post("/shorts/:id/review", sh.adminReview);
router.get("/shorts", sh.adminList);
router.post("/shorts", sh.adminCreate);
router.put("/shorts/:id", sh.adminUpdate);
router.delete("/shorts/:id", sh.adminDelete);

// Creators and their weekly payouts
const ac = require("../controllers/adminCreatorController");
router.get("/creators", ac.listCreators);
router.put("/creators/:id", ac.updateCreator);
router.post("/creators/:id/reset-password", ac.resetCreatorPassword);
router.get("/payouts", ac.listPayouts);
router.post("/payouts/generate", ac.generatePayoutsNow);
router.put("/payouts/:id", ac.updatePayout);

router.get("/formulas", c.listFormulas);
router.post("/formulas", c.createFormula);
router.put("/formulas/:id", c.updateFormula);
router.delete("/formulas/:id", c.deleteFormula);

module.exports = router;
