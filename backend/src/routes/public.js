const router = require("express").Router();
const { getSampleQuiz } = require("../controllers/publicController");

// Deliberately NOT behind protect/requireActiveSubscription — this is the
// public, no-login taster quiz linked from Raise Academy's landing page.
router.get("/sample-quiz", getSampleQuiz);

// Challenge a friend (app.yneet.in/c/:attemptId): what the friend sees before
// signing in — first name, score and the test. Only submitted attempts; no answers.
router.get("/challenge/:attemptId", async (req, res) => {
  try {
    const { prisma } = require("../utils/allIndia");
    const a = await prisma.attempt.findUnique({
      where: { id: String(req.params.attemptId) },
      select: { id: true, status: true, score: true, accuracy: true, timeTaken: true,
        user: { select: { name: true, referralCode: true, profile: { select: { class: true } } } },
        mockTest: { select: { id: true, title: true, type: true, totalQs: true, totalMarks: true, durationMin: true } } },
    });
    // Not for Class 6–8 (younger children; same rule as the score cards).
    if (!a || a.status !== "submitted" || ["6th", "7th", "8th"].includes(a.user?.profile?.class)) {
      return res.status(404).json({ success: false, message: "This challenge link isn't valid any more." });
    }
    res.json({
      success: true,
      challenge: {
        attemptId: a.id, name: String(a.user?.name || "Your friend").split(" ")[0], referralCode: a.user?.referralCode || "",
        score: a.score, accuracy: Math.round(a.accuracy || 0), minutes: Math.round((a.timeTaken || 0) / 60),
        test: a.mockTest,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Couldn't load this challenge." });
  }
});

// Crash reports from students' browsers / the Android app (frontend
// lib/errorReport.js). Logged only, so they show in Railway's logs; no storage.
// Sent as text/plain (no CORS preflight for sendBeacon), so parse it here.
router.post("/client-error", require("express").text({ type: "*/*", limit: "8kb" }), (req, res) => {
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const clip = (v, n) => String(v ?? "").replace(/[\r\n]+/g, " ⏎ ").slice(0, n);
    console.warn(`[client-error] ${clip(b.kind, 12)} ${clip(b.url, 200)} app=${b.app ? 1 : 0} :: ${clip(b.message, 300)} :: ${clip(b.stack, 900)} :: ${clip(b.ua, 160)}`);
  } catch { /* malformed report: ignore */ }
  res.status(204).end();
});

// Unsubscribe link in the institute follow-up emails (utils/instituteDrip.js).
// GET shows a confirmation page; POST is the one-click List-Unsubscribe from mail apps.
const unsubPage = (ok) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YNeet</title>
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:460px;margin:60px auto;padding:24px;text-align:center">
<h2 style="color:#1e3a8a">${ok ? "You're unsubscribed" : "Link not valid"}</h2>
<p style="color:#475569">${ok ? "You won't get any more emails from us about YNeet for institutes." : "This unsubscribe link looks incomplete. Reply to our email with \"unsubscribe\" and we'll remove you."}</p>
<p><a href="https://www.yneet.in" style="color:#2563eb">www.yneet.in</a></p></div>`;
router.get("/unsubscribe", async (req, res) => {
  let ok = false;
  try { ok = await require("../utils/instituteDrip").unsubscribe(req.query.e, req.query.t); } catch (e) { console.error("[unsubscribe]", e.message); }
  res.status(ok ? 200 : 400).type("html").send(unsubPage(ok));
});
router.post("/unsubscribe", require("express").urlencoded({ extended: false }), async (req, res) => {
  try { await require("../utils/instituteDrip").unsubscribe(req.query.e, req.query.t); } catch (e) { console.error("[unsubscribe]", e.message); }
  res.status(200).end();
});

// Featured YNeet Shorts — landing page section and the public share page (/s/:id).
const { publicFeatured, publicShort } = require("../controllers/shortsController");
router.get("/shorts/featured", publicFeatured);
router.get("/shorts/:id", publicShort);

// Free chapter practice pages on www.yneet.in (no login; SEO).
const { listChapters, getChapter, readinessQuiz, listQuestionPages, getQuestionPage, listSchoolPages, getSchoolPage } = require("../controllers/practicePagesController");
router.get("/practice", listChapters);
router.get("/practice/:subject/:chapter", getChapter);
router.get("/practice/:subject/:chapter/daily", require("../controllers/practicePagesController").chapterDaily); // chapter PYQ widget
// One-question pages on www.yneet.in/neet-question/<slug> (no login; SEO).
router.get("/questions", listQuestionPages);
router.get("/pyq-book", require("../controllers/practicePagesController").pyqBook); // books/ PDF generator
router.get("/questions/daily", require("../controllers/practicePagesController").dailyShorts); // YouTube Shorts bot
router.get("/questions/:slug", getQuestionPage);
// Class 6–10 question pages on www.yneet.in/class-<n>-questions (no login; SEO).
router.get("/school-questions", listSchoolPages);
router.get("/school-questions/daily", require("../controllers/practicePagesController").schoolChapterDaily); // chapter PYQ widget (before :slug)
router.get("/school-questions/:slug", getSchoolPage);
router.get("/readiness", readinessQuiz);
// Most-missed NEET chapters and questions from YNeet answers (totals only) for www.yneet.in/neet-most-missed-chapters.
router.get("/missed-stats", require("../controllers/missedStatsController").missedStats);

// Question of the Day + previous-year papers by year (no login).
const { questionOfTheDay, listPapers, getPaper } = require("../controllers/publicExtrasController");
router.get("/qotd", questionOfTheDay);
router.get("/papers", listPapers);
router.get("/papers/:year", getPaper);

// Brain Teaser of the week for the public website page (no login; never the answer before the reveal).
router.get("/teaser", require("./weekly").publicTeaser);
// Yesterday's NEET 60-Second Sprint for www.yneet.in/neet-sprint (no login).
router.get("/sprint/yesterday", require("./sprint").publicYesterday);
// Concept maps for www.yneet.in/neet-concept-maps (no login).
router.get("/maps", require("./weekly").publicMaps);
router.get("/maps/:id", require("./weekly").publicMap);

// Ask YNeet: featured answered doubts for the website page (no login, no names).
router.get("/doubts", require("./doubts").publicFeatured);

// Email confirmation link (opened from the inbox, no login needed).
router.post("/verify-email", require("../controllers/verifyController").confirmEmail);

module.exports = router;
