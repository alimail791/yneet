// /api/v1/ask — Ask YNeet for students. Anyone signed in can read the featured
// answers; sending a doubt needs an active plan or the free Class 6–8 tier.
const router = require("express").Router();
const { protect } = require("../middleware/auth");
const D = require("../utils/doubts");
const p = D.prisma;

router.use(protect);
router.use((req, res, next) => D.ensureTables().then(() => next()).catch(next));

const canAsk = (user) => D.hasPlan(user) || D.isJunior(user) || user.role === "admin";

// My doubts (newest first) + today's remaining count + this week's featured ones.
router.get("/", async (req, res, next) => {
  try {
    const mine = await p.$queryRaw`
      SELECT id, subject, question, (image IS NOT NULL) AS has_image, answer, status, note, created_at, answered_at, seen_at
      FROM doubts.items WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 30`;
    const today = (await p.$queryRaw`SELECT COUNT(*)::int AS n FROM doubts.items
      WHERE user_id = ${req.user.id} AND created_at > NOW() - INTERVAL '24 hours'`)[0].n;
    const featured = await p.$queryRaw`
      SELECT id, cls, subject, question, answer, featured_on FROM doubts.items
      WHERE status = 'answered' AND featured_on IS NOT NULL AND featured_on <= ${D.istDay()}
      ORDER BY featured_on DESC LIMIT 6`;
    // Opening the page counts as having seen new answers.
    await p.$executeRaw`UPDATE doubts.items SET seen_at = NOW() WHERE user_id = ${req.user.id} AND status <> 'pending' AND seen_at IS NULL`;
    res.json({ success: true, canAsk: canAsk(req.user), left: Math.max(0, D.DAILY_LIMIT - today), subjects: D.SUBJECTS, mine, featured });
  } catch (err) { next(err); }
});

// For the home card: answers the student hasn't opened yet.
router.get("/unseen", async (req, res, next) => {
  try {
    const n = (await p.$queryRaw`SELECT COUNT(*)::int AS n FROM doubts.items
      WHERE user_id = ${req.user.id} AND status = 'answered' AND seen_at IS NULL`)[0].n;
    res.json({ success: true, unseen: n });
  } catch (err) { next(err); }
});

router.get("/:id/image", async (req, res, next) => {
  try {
    const d = (await p.$queryRaw`SELECT user_id, image FROM doubts.items WHERE id = ${Number(req.params.id)}`)[0];
    if (!d || (d.user_id !== req.user.id && req.user.role !== "admin") || !d.image) return res.status(404).end();
    res.json({ success: true, image: d.image });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    // 403 (not 402) so the app doesn't jump to the pricing page.
    if (!canAsk(req.user)) return res.status(403).json({ success: false, needsPlan: true, message: "Asking doubts is part of an active YNeet plan." });
    const subject = D.SUBJECTS.includes(req.body.subject) ? req.body.subject : "Other";
    const question = String(req.body.question || "").trim().slice(0, 1500);
    let image = typeof req.body.image === "string" ? req.body.image : null;
    if (image && (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > D.MAX_IMAGE_CHARS)) {
      return res.status(400).json({ success: false, message: "That photo is too large. Please try a smaller one." });
    }
    if (!question && !image) return res.status(400).json({ success: false, message: "Type your doubt or add a photo." });
    if (question && question.length < 8 && !image) return res.status(400).json({ success: false, message: "Please write a little more so the teacher understands." });
    const today = (await p.$queryRaw`SELECT COUNT(*)::int AS n FROM doubts.items
      WHERE user_id = ${req.user.id} AND created_at > NOW() - INTERVAL '24 hours'`)[0].n;
    if (today >= D.DAILY_LIMIT) return res.status(429).json({ success: false, message: `You can send ${D.DAILY_LIMIT} doubts a day. Try again tomorrow.` });
    const cls = req.user.profile?.class || null;
    const rows = await p.$queryRaw`INSERT INTO doubts.items (user_id, cls, subject, question, image)
      VALUES (${req.user.id}, ${cls}, ${subject}, ${question || "(photo)"}, ${image}) RETURNING id`;
    D.draftInBackground(rows[0].id);
    res.json({ success: true, id: rows[0].id, left: Math.max(0, D.DAILY_LIMIT - today - 1) });
  } catch (err) { next(err); }
});

// Public (no login): featured answers for the website page. Mounted in routes/public.js.
router.publicFeatured = async (req, res) => {
  try {
    await D.ensureTables();
    const rows = await p.$queryRaw`
      SELECT id, cls, subject, question, answer, featured_on FROM doubts.items
      WHERE status = 'answered' AND featured_on IS NOT NULL AND featured_on <= ${D.istDay()}
      ORDER BY featured_on DESC LIMIT 20`;
    res.set("Cache-Control", "public, max-age=600");
    res.json({ success: true, doubts: rows });
  } catch (err) { res.status(500).json({ success: false, message: "Could not load answers" }); }
};

module.exports = router;
