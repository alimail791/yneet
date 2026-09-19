const router = require("express").Router();
const { getSampleQuiz } = require("../controllers/publicController");

// Deliberately NOT behind protect/requireActiveSubscription — this is the
// public, no-login taster quiz linked from Raise Academy's landing page.
router.get("/sample-quiz", getSampleQuiz);

module.exports = router;
