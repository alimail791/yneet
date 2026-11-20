const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { reportQuestion } = require("../controllers/questionReportController");

router.post("/", protect, reportQuestion);

module.exports = router;
