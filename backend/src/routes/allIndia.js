// /api/v1/allindia — the free weekly All-India NEET Mock (see utils/allIndia.js).
// Open to every signed-in Class 9–Dropper student, with or without a plan.
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const A = require("../utils/allIndia");

router.use(protect);

// This Sunday's mock (upcoming / live / just finished) + last Sunday's results.
router.get("/", async (req, res, next) => {
  try {
    if (A.isJuniorClass(req.user.profile?.class)) {
      return res.json({ success: true, eligible: false, message: "The All-India Mock is for Class 9 to Dropper students." });
    }
    const day = A.thisSunday();
    const status = A.statusFor(day);
    // Build the paper ahead of time (from Saturday) so Sunday morning is instant.
    const test = (status !== "upcoming" || A.dow(A.istToday()) === 6) ? await A.ensureTest(day) : await A.findTest(day);
    let mine = null;
    if (test) {
      const a = await A.findTestAttempts(test.id, req.user.id);
      if (a) mine = { id: a.id, status: a.status, score: a.score };
    }
    const current = {
      date: day, label: A.prettyDate(day), status, opensAt: A.opensAt(day), closesAt: A.closesAt(day),
      testId: test?.id || null, totalQs: test?.totalQs || Object.values(A.COUNTS).reduce((s, n) => s + n, 0),
      durationMin: test?.durationMin || A.DURATION_MIN, totalMarks: test?.totalMarks || null, myAttempt: mine,
      board: test && status === "live" ? await A.leaderboard(test, req.user.id, 10) : null,
    };
    const lastDay = A.lastFinishedSunday();
    const lastTest = await A.findTest(lastDay);
    const last = lastTest ? { date: lastDay, label: A.prettyDate(lastDay), testId: lastTest.id, title: lastTest.title, ...(await A.leaderboard(lastTest, req.user.id, 50)) } : null;
    res.json({ success: true, eligible: true, current, last });
  } catch (err) { next(err); }
});

// Full rank list for any past/current All-India mock.
router.get("/:testId/leaderboard", async (req, res, next) => {
  try {
    const test = await A.prisma.mockTest.findUnique({ where: { id: req.params.testId } });
    if (!A.isAllIndia(test)) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, title: test.title, date: test.subject, ...(await A.leaderboard(test, req.user.id, 100)) });
  } catch (err) { next(err); }
});

module.exports = router;
