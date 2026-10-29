const router = require("express").Router();
const { getSampleQuiz } = require("../controllers/publicController");

// Deliberately NOT behind protect/requireActiveSubscription — this is the
// public, no-login taster quiz linked from Raise Academy's landing page.
router.get("/sample-quiz", getSampleQuiz);

// Featured YNeet Shorts — landing page section and the public share page (/s/:id).
const { publicFeatured, publicShort } = require("../controllers/shortsController");
router.get("/shorts/featured", publicFeatured);
router.get("/shorts/:id", publicShort);

// Free chapter practice pages on www.yneet.in (no login; SEO).
const { listChapters, getChapter, readinessQuiz } = require("../controllers/practicePagesController");
router.get("/practice", listChapters);
router.get("/practice/:subject/:chapter", getChapter);
router.get("/readiness", readinessQuiz);

// Question of the Day + previous-year papers by year (no login).
const { questionOfTheDay, listPapers, getPaper } = require("../controllers/publicExtrasController");
router.get("/qotd", questionOfTheDay);
router.get("/papers", listPapers);
router.get("/papers/:year", getPaper);

// Email confirmation link (opened from the inbox, no login needed).
router.post("/verify-email", require("../controllers/verifyController").confirmEmail);

module.exports = router;
