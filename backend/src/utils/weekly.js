// Weekly series: Concept Map Monday and Brain Teaser Wednesday.
//
// AI writes drafts (admin presses Generate); nothing reaches students until an
// admin approves it and it has a publish date. Approving without a date puts it
// on the next free Monday (maps, per class group) or Wednesday (teasers).
//
// Stored in their own Postgres schema, "weekly", created here with plain SQL —
// not in prisma/schema.prisma, so `prisma db push` never touches it.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { GROUPS, groupFor, istDay } = require("./sprint");

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEASER_CLASSES = ["6th", "7th", "8th"];

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS weekly`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS weekly.concept_maps (
        id         SERIAL PRIMARY KEY,
        grp        TEXT NOT NULL,
        subject    TEXT NOT NULL,
        chapter    TEXT NOT NULL,
        data       JSONB NOT NULL,
        status     TEXT NOT NULL DEFAULT 'draft',
        publish_on TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS weekly.teasers (
        id          SERIAL PRIMARY KEY,
        data        JSONB NOT NULL,
        status      TEXT NOT NULL DEFAULT 'draft',
        publish_on  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS weekly.teaser_answers (
        teaser_id  INT NOT NULL,
        user_id    TEXT NOT NULL,
        choice     INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (teaser_id, user_id)
      )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// ── Dates (all IST, as YYYY-MM-DD) ──
const dow = (day) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const nextWeekday = (fromDay, weekday) => { // first `weekday` on or after fromDay
  let d = fromDay;
  while (dow(d) !== weekday) d = addDays(d, 1);
  return d;
};
// Answer revealed the day after publishing, 7 PM IST.
const teaserRevealAt = (publishOn) => Date.parse(`${addDays(publishOn, 1)}T19:00:00+05:30`);

// Next free slot: the first `weekday` from today on that no approved item already has.
async function nextFreeSlot(table, weekday, grp) {
  const rows = grp
    ? await prisma.$queryRawUnsafe(`SELECT publish_on FROM weekly.${table} WHERE status = 'approved' AND grp = $1 AND publish_on IS NOT NULL`, grp)
    : await prisma.$queryRawUnsafe(`SELECT publish_on FROM weekly.${table} WHERE status = 'approved' AND publish_on IS NOT NULL`);
  const taken = new Set(rows.map((r) => r.publish_on));
  let d = nextWeekday(istDay(), weekday);
  while (taken.has(d)) d = addDays(d, 7);
  return d;
}

// ── Cleaning what the AI (or an admin edit) sends ──
const str = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function cleanMap(d) {
  const branches = (Array.isArray(d?.branches) ? d.branches : []).slice(0, 6).map((b) => ({
    heading: str(b?.heading, 40),
    points: (Array.isArray(b?.points) ? b.points : []).map((p) => str(p, 80)).filter(Boolean).slice(0, 5),
  })).filter((b) => b.heading && b.points.length);
  if (branches.length < 3) throw new Error("A concept map needs at least 3 branches with points.");
  return {
    title: str(d?.title, 60) || "Concept map",
    center: { heading: str(d?.center?.heading, 50), detail: str(d?.center?.detail, 120) },
    branches,
    remember: str(d?.remember, 160),
  };
}

function cleanTeaser(d) {
  const clues = (Array.isArray(d?.clues) ? d.clues : []).map((c) => str(c, 90)).filter(Boolean).slice(0, 4);
  const options = (Array.isArray(d?.options) ? d.options : []).map((o) => str(o, 40)).slice(0, 4);
  const answer = Number(d?.answer);
  if (clues.length < 2) throw new Error("A teaser needs at least 2 clues.");
  if (options.length !== 4 || options.some((o) => !o)) throw new Error("A teaser needs 4 answer choices.");
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new Error("Pick the correct answer (A–D).");
  return { title: str(d?.title, 40) || "Who am I?", clues, options, answer, explanation: str(d?.explanation, 300), topic: str(d?.topic, 60) };
}

// ── AI drafts ──
async function draftMap(grp, subject, chapter) {
  const { anthropic, extractJson, MODEL } = require("./anthropicClient");
  const level = { neet: "NEET (Class 11–12 NCERT)", foundation: "Class 9–10 NCERT (NEET Foundation)", junior: "Class 6–8 NCERT" }[grp];
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `You make one-page concept maps for Indian students revising ${level}. Be strictly accurate to the NCERT syllabus; never invent facts. Keep every point short (under 10 words) and exam-useful. Respond with ONLY raw JSON, no prose, no markdown fences.`,
    messages: [{
      role: "user",
      content: `Make a concept map for: ${subject} · ${chapter}.
JSON shape:
{"title": "<chapter name>",
 "center": {"heading": "<core idea, 2-5 words>", "detail": "<one key equation or definition, under 15 words>"},
 "branches": [{"heading": "<sub-topic, 1-4 words>", "points": ["<fact>", "<fact>", "<fact>"]}],
 "remember": "<one high-yield fact students often get wrong, under 25 words>"}
Use 4 to 6 branches with 3 or 4 points each. Plain text only (Unicode subscripts like CO₂ are fine).`,
    }],
  });
  return cleanMap(extractJson(msg.content.map((c) => c.text || "").join("")));
}

async function draftTeasers(count = 10, avoid = []) {
  const { anthropic, extractJson, MODEL } = require("./anthropicClient");
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: "You write fun, accurate science brain teasers for Indian students in Class 6–8, based only on their NCERT Science syllabus. Each teaser must have exactly one clearly correct answer. Simple English a 12-year-old understands. Respond with ONLY a raw JSON array, no prose, no markdown fences.",
    messages: [{
      role: "user",
      content: `Write ${count} brain teasers, each on a different topic (mix physics, chemistry and biology topics from Class 6–8 Science).
Each item: {"title": "Who am I?" or "What am I?" or a short puzzle title, "clues": ["<clue 1>", "<clue 2>", "<clue 3>"] (each under 14 words, getting easier from 1 to 3), "options": ["<A>", "<B>", "<C>", "<D>"] (short, plausible), "answer": <0-3, vary the position>, "explanation": "<why, in 1-2 short sentences>", "topic": "<NCERT chapter or topic>"}
${avoid.length ? `Do not repeat these answers: ${avoid.slice(0, 60).join(", ")}.` : ""}`,
    }],
  });
  const arr = extractJson(msg.content.map((c) => c.text || "").join(""));
  const out = [];
  for (const t of Array.isArray(arr) ? arr : []) { try { out.push(cleanTeaser(t)); } catch { /* skip a malformed one */ } }
  return out;
}

module.exports = {
  prisma, ensureTables, GROUPS, groupFor, istDay, addDays, dow, teaserRevealAt, nextFreeSlot,
  cleanMap, cleanTeaser, draftMap, draftTeasers, TEASER_CLASSES, IST_MS,
};
