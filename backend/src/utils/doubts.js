// Ask YNeet: students send doubts (text and/or a photo), AI drafts an answer
// at once, and a teacher checks, edits and sends it from Admin → Doubts.
// Each Friday one answered doubt is featured (app, website, channel post).
//
// Stored in its own Postgres schema, "doubts", created here with plain SQL —
// not in prisma/schema.prisma, so `prisma db push` never touches it.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "Other"];
const DAILY_LIMIT = 3;
const MAX_IMAGE_CHARS = 1_400_000; // ~1 MB JPEG as a data URL; the app shrinks photos first

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS doubts`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS doubts.items (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        cls         TEXT,
        subject     TEXT NOT NULL,
        question    TEXT NOT NULL,
        image       TEXT,
        ai_draft    TEXT,
        answer      TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        note        TEXT,
        featured_on TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        answered_at TIMESTAMPTZ,
        seen_at     TIMESTAMPTZ
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS items_user_idx ON doubts.items (user_id, created_at DESC)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS items_status_idx ON doubts.items (status, created_at)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const hasPlan = (user) => {
  const s = user?.subscription;
  return !!(s?.status === "active" && s?.endDate && new Date(s.endDate) > new Date());
};
const isJunior = (user) => ["6th", "7th", "8th"].includes(user?.profile?.class);

// AI draft for the teacher to check. Never shown to the student unless approved.
async function draftAnswer(d) {
  const { anthropic, MODEL } = require("./anthropicClient");
  const content = [];
  const m = d.image && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(d.image);
  if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  content.push({ type: "text", text: `Student class: ${d.cls || "unknown"} · Subject: ${d.subject}\nDoubt: ${d.question || "(see the photo)"}` });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: "You are a kind, accurate NEET and school science teacher in India answering a student's doubt. Answer in simple English, step by step, in under 180 words, following the NCERT syllabus. If there is a photo, read the question from it. If it is a numerical, show the working. Plain text only, no markdown headers or bold. If the message is not a study doubt, reply exactly: NOT A STUDY DOUBT.",
    messages: [{ role: "user", content }],
  });
  return msg.content.map((c) => c.text || "").join("").trim();
}

// Make (or remake) the draft in the background; the student's request doesn't wait for it.
function draftInBackground(id) {
  (async () => {
    const d = (await prisma.$queryRaw`SELECT * FROM doubts.items WHERE id = ${id}`)[0];
    if (!d) return;
    const text = await draftAnswer(d);
    await prisma.$executeRaw`UPDATE doubts.items SET ai_draft = ${text} WHERE id = ${id}`;
  })().catch((e) => console.warn(`[doubts] AI draft failed for #${id}:`, e.message));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const istDay = (t = Date.now()) => new Date(t + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
async function nextFreeFriday() {
  const taken = new Set((await prisma.$queryRaw`SELECT featured_on FROM doubts.items WHERE featured_on IS NOT NULL`).map((r) => r.featured_on));
  let d = istDay();
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 5 || taken.has(d)) d = new Date(Date.parse(`${d}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  return d;
}

module.exports = { prisma, ensureTables, SUBJECTS, DAILY_LIMIT, MAX_IMAGE_CHARS, hasPlan, isJunior, draftInBackground, nextFreeFriday, istDay };
