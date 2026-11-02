// /api/v1/push — turn notifications on/off for the signed-in student.
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const push = require("../utils/push");

// The browser needs this public key to create a subscription.
router.get("/public-key", (req, res) => {
  res.json({ success: true, enabled: push.enabled, key: process.env.VAPID_PUBLIC_KEY || null });
});

router.post("/subscribe", protect, async (req, res) => {
  try {
    if (!push.enabled) return res.status(503).json({ success: false, message: "Notifications are not set up yet" });
    await push.saveSubscription(req.user.id, req.body.subscription, req.body.inApp);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.post("/unsubscribe", protect, async (req, res) => {
  try {
    if (req.body.endpoint) await push.removeSubscription(req.body.endpoint);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// A welcome notification right after turning them on, so the student sees it works.
router.post("/test", protect, async (req, res) => {
  try {
    const rows = await push.subscriptionsForUser(req.user.id);
    const r = await push.sendTo(rows, {
      title: "Reminders are on",
      body: "You'll get the NEET Question of the Day every morning at 7.",
      url: "/qotd", tag: "welcome",
    });
    res.json({ success: true, ...r });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
