// /api/v1/admin/weekly — draft, edit, approve and schedule Concept Maps and
// Brain Teasers. Mounted inside routes/admin.js, so admin-only.
const router = require("express").Router();
const W = require("../utils/weekly");
const p = W.prisma;

router.use((req, res, next) => W.ensureTables().then(() => next()).catch(next));
const fail = (res, err, code = 400) => res.status(code).json({ success: false, message: err.message || String(err) });
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// Chapters available for a class group (from the question bank), most questions first.
router.get("/chapters", async (req, res) => {
  try {
    const grp = W.GROUPS[req.query.grp] ? req.query.grp : "neet";
    const rows = await p.$queryRaw`
      SELECT subject, chapter, COUNT(*)::int AS n FROM questions
      WHERE "classLevel" = ANY(${W.GROUPS[grp].classes}) AND chapter <> ''
      GROUP BY subject, chapter ORDER BY subject, n DESC`;
    const used = await p.$queryRaw`SELECT subject, chapter FROM weekly.concept_maps WHERE grp = ${grp}`;
    const usedSet = new Set(used.map((u) => `${u.subject}|${u.chapter}`));
    res.json({ success: true, chapters: rows.map((r) => ({ ...r, done: usedSet.has(`${r.subject}|${r.chapter}`) })) });
  } catch (err) { fail(res, err, 500); }
});

// ── Concept maps ──
router.get("/maps", async (req, res) => {
  try {
    const rows = await p.$queryRaw`SELECT * FROM weekly.concept_maps ORDER BY (status = 'draft') DESC, publish_on DESC NULLS LAST, id DESC LIMIT 200`;
    res.json({ success: true, maps: rows, today: W.istDay() });
  } catch (err) { fail(res, err, 500); }
});

router.post("/maps/generate", async (req, res) => {
  try {
    const grp = W.GROUPS[req.body.grp] ? req.body.grp : "neet";
    const subject = String(req.body.subject || "").trim();
    const chapter = String(req.body.chapter || "").trim();
    if (!subject || !chapter) return fail(res, new Error("Pick a subject and chapter."));
    const data = await W.draftMap(grp, subject, chapter);
    const rows = await p.$queryRaw`INSERT INTO weekly.concept_maps (grp, subject, chapter, data) VALUES (${grp}, ${subject}, ${chapter}, ${JSON.stringify(data)}::jsonb) RETURNING *`;
    res.json({ success: true, map: rows[0] });
  } catch (err) { fail(res, err, 500); }
});

router.put("/maps/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = (await p.$queryRaw`SELECT * FROM weekly.concept_maps WHERE id = ${id}`)[0];
    if (!cur) return fail(res, new Error("Not found"), 404);
    const data = req.body.data ? W.cleanMap(req.body.data) : cur.data;
    const status = ["draft", "approved"].includes(req.body.status) ? req.body.status : cur.status;
    let publishOn = req.body.publishOn === null ? null : isDay(req.body.publishOn) ? req.body.publishOn : cur.publish_on;
    if (status === "approved" && !publishOn) publishOn = await W.nextFreeSlot("concept_maps", 1, cur.grp); // Monday
    if (status === "draft") publishOn = null;
    const rows = await p.$queryRaw`UPDATE weekly.concept_maps SET data = ${JSON.stringify(data)}::jsonb, status = ${status}, publish_on = ${publishOn}
      WHERE id = ${id} RETURNING *`;
    res.json({ success: true, map: rows[0] });
  } catch (err) { fail(res, err); }
});

router.delete("/maps/:id", async (req, res) => {
  try { await p.$executeRaw`DELETE FROM weekly.concept_maps WHERE id = ${Number(req.params.id)}`; res.json({ success: true }); }
  catch (err) { fail(res, err, 500); }
});

// ── Brain teasers ──
router.get("/teasers", async (req, res) => {
  try {
    const rows = await p.$queryRaw`
      SELECT t.*, COALESCE(a.n, 0)::int AS players, COALESCE(a.correct, 0)::int AS correct
      FROM weekly.teasers t
      LEFT JOIN (SELECT ta.teaser_id, COUNT(*) AS n, COUNT(*) FILTER (WHERE ta.choice = (tt.data->>'answer')::int) AS correct
                 FROM weekly.teaser_answers ta JOIN weekly.teasers tt ON tt.id = ta.teaser_id GROUP BY ta.teaser_id) a ON a.teaser_id = t.id
      ORDER BY (t.status = 'draft') DESC, t.publish_on DESC NULLS LAST, t.id DESC LIMIT 300`;
    res.json({ success: true, teasers: rows, today: W.istDay() });
  } catch (err) { fail(res, err, 500); }
});

router.post("/teasers/generate", async (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.body.count) || 10, 1), 15);
    const prev = await p.$queryRaw`SELECT data FROM weekly.teasers ORDER BY id DESC LIMIT 100`;
    const avoid = prev.map((r) => r.data?.options?.[r.data?.answer]).filter(Boolean);
    const drafts = await W.draftTeasers(count, avoid);
    for (const d of drafts) await p.$executeRaw`INSERT INTO weekly.teasers (data) VALUES (${JSON.stringify(d)}::jsonb)`;
    res.json({ success: true, created: drafts.length });
  } catch (err) { fail(res, err, 500); }
});

router.put("/teasers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = (await p.$queryRaw`SELECT * FROM weekly.teasers WHERE id = ${id}`)[0];
    if (!cur) return fail(res, new Error("Not found"), 404);
    const data = req.body.data ? W.cleanTeaser(req.body.data) : cur.data;
    const status = ["draft", "approved"].includes(req.body.status) ? req.body.status : cur.status;
    let publishOn = req.body.publishOn === null ? null : isDay(req.body.publishOn) ? req.body.publishOn : cur.publish_on;
    if (status === "approved" && !publishOn) publishOn = await W.nextFreeSlot("teasers", 3, null); // Wednesday
    if (status === "draft") publishOn = null;
    const rows = await p.$queryRaw`UPDATE weekly.teasers SET data = ${JSON.stringify(data)}::jsonb, status = ${status}, publish_on = ${publishOn}
      WHERE id = ${id} RETURNING *`;
    res.json({ success: true, teaser: rows[0] });
  } catch (err) { fail(res, err); }
});

router.delete("/teasers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await p.$executeRaw`DELETE FROM weekly.teaser_answers WHERE teaser_id = ${id}`;
    await p.$executeRaw`DELETE FROM weekly.teasers WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err) { fail(res, err, 500); }
});

module.exports = router;
