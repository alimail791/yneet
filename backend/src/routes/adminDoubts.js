// /api/v1/admin/doubts — the teacher's queue. Mounted inside routes/admin.js (admin-only).
const router = require("express").Router();
const D = require("../utils/doubts");
const p = D.prisma;

router.use((req, res, next) => D.ensureTables().then(() => next()).catch(next));
const fail = (res, err, code = 400) => res.status(code).json({ success: false, message: err.message || String(err) });

// status = pending | answered | rejected | featured
router.get("/", async (req, res) => {
  try {
    const status = ["pending", "answered", "rejected", "featured"].includes(req.query.status) ? req.query.status : "pending";
    const rows = status === "featured"
      ? await p.$queryRaw`SELECT d.id, d.user_id, d.cls, d.subject, d.question, (d.image IS NOT NULL) AS has_image, d.ai_draft, d.answer, d.status, d.note, d.featured_on, d.created_at, d.answered_at, u.name, u.phone
          FROM doubts.items d LEFT JOIN users u ON u.id = d.user_id WHERE d.featured_on IS NOT NULL ORDER BY d.featured_on DESC LIMIT 100`
      : await p.$queryRaw`SELECT d.id, d.user_id, d.cls, d.subject, d.question, (d.image IS NOT NULL) AS has_image, d.ai_draft, d.answer, d.status, d.note, d.featured_on, d.created_at, d.answered_at, u.name, u.phone
          FROM doubts.items d LEFT JOIN users u ON u.id = d.user_id WHERE d.status = ${status}
          ORDER BY CASE WHEN ${status} = 'pending' THEN d.created_at END ASC, d.created_at DESC LIMIT 100`;
    const counts = await p.$queryRaw`SELECT status, COUNT(*)::int AS n FROM doubts.items GROUP BY status`;
    res.json({ success: true, doubts: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])), today: D.istDay() });
  } catch (err) { fail(res, err, 500); }
});

router.post("/:id/redraft", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await p.$executeRaw`UPDATE doubts.items SET ai_draft = NULL WHERE id = ${id}`;
    D.draftInBackground(id);
    res.json({ success: true });
  } catch (err) { fail(res, err, 500); }
});

// Send the (edited) answer to the student.
router.post("/:id/answer", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const answer = String(req.body.answer || "").trim().slice(0, 4000);
    if (answer.length < 5) return fail(res, new Error("Write the answer first."));
    const rows = await p.$queryRaw`UPDATE doubts.items SET answer = ${answer}, status = 'answered', note = NULL, answered_at = COALESCE(answered_at, NOW()), seen_at = NULL
      WHERE id = ${id} RETURNING user_id, subject`;
    if (!rows[0]) return fail(res, new Error("Not found"), 404);
    const push = require("../utils/push");
    push.subscriptionsForUser(rows[0].user_id)
      .then((subs) => push.sendTo(subs, { title: "Your doubt is answered", body: `A teacher answered your ${rows[0].subject} doubt. Tap to read it.`, url: "/ask", tag: `doubt-${id}` }))
      .catch(() => {});
    res.json({ success: true });
  } catch (err) { fail(res, err, 500); }
});

// Not a study doubt / can't answer: tell the student why.
router.post("/:id/reject", async (req, res) => {
  try {
    const note = String(req.body.note || "This doesn't look like a study doubt.").trim().slice(0, 300);
    await p.$executeRaw`UPDATE doubts.items SET status = 'rejected', note = ${note}, answered_at = NOW(), seen_at = NULL, featured_on = NULL WHERE id = ${Number(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { fail(res, err, 500); }
});

// Feature an answered doubt on a Friday (default: the next free Friday), or remove it (date = null).
router.post("/:id/feature", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const d = (await p.$queryRaw`SELECT status FROM doubts.items WHERE id = ${id}`)[0];
    if (!d) return fail(res, new Error("Not found"), 404);
    if (d.status !== "answered") return fail(res, new Error("Send the answer first, then feature it."));
    const date = req.body.date === null ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || "")) ? req.body.date : await D.nextFreeFriday();
    await p.$executeRaw`UPDATE doubts.items SET featured_on = ${date} WHERE id = ${id}`;
    res.json({ success: true, featuredOn: date });
  } catch (err) { fail(res, err, 500); }
});

module.exports = router;
