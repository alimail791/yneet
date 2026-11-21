// Automatic follow-up emails selling the YNeet institute pack to schools,
// institutes and coaching centres (same idea as ClassCoach's lib/emailDrip.js).
// Runs inside this server, so nobody has to run a script every day.
//
// - Leads are imported from Admin → Institute emails (CSV or pasted list).
// - Starts PAUSED. Preview the emails, send yourself a test, then press Start.
// - Sends only 9am–7pm India time, in small batches every 20 minutes, up to
//   INSTITUTE_DRIP_DAILY_CAP a day (default 70, leaving room under Resend's
//   free 100/day for sign-up and reminder emails).
// - Four emails; each waits gapDays after the previous one. Skips anyone who
//   unsubscribed, whose earlier email failed (bounced), or whom the admin
//   stopped (bought, replied, not interested). One-click unsubscribe link +
//   List-Unsubscribe header.
//
// Storage: its own Postgres schema "outreach", created here with plain SQL —
// NOT in prisma/schema.prisma (same approach as utils/push.js), so the Prisma
// schema and `prisma db push` are untouched.
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { Resend } = require("resend");
const prisma = new PrismaClient();

let resend;
const getResend = () => (resend ||= new Resend(process.env.RESEND_API_KEY));
const KEY = () => process.env.RESEND_API_KEY || "";
const FROM = () => process.env.INSTITUTE_DRIP_FROM || "Akbar from YNeet <info@yneet.in>";
const REPLY_TO = () => process.env.INSTITUTE_DRIP_REPLY_TO || process.env.RESEND_REPLY_TO || "info@yneet.in";
const DAILY_CAP = () => parseInt(process.env.INSTITUTE_DRIP_DAILY_CAP, 10) || 70;
const PER_TICK = 12;
const SITE = "https://www.yneet.in";
const WA = "https://wa.me/919443424064";

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS outreach`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS outreach.institute_leads (
        id          SERIAL PRIMARY KEY,
        email       TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL DEFAULT '',
        institute   TEXT NOT NULL DEFAULT '',
        city        TEXT NOT NULL DEFAULT '',
        kind        TEXT NOT NULL DEFAULT 'coaching', -- coaching | school
        status      TEXT NOT NULL DEFAULT 'active',   -- active | stopped | unsubscribed
        note        TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS outreach.institute_drip (
        id       SERIAL PRIMARY KEY,
        lead_id  INTEGER NOT NULL REFERENCES outreach.institute_leads(id) ON DELETE CASCADE,
        step     INTEGER NOT NULL,
        status   TEXT NOT NULL DEFAULT 'sent', -- sent | failed
        error    TEXT NOT NULL DEFAULT '',
        sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (lead_id, step)
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS institute_drip_sent_idx ON outreach.institute_drip (sent_at)`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS outreach.meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

async function meta(key, value) {
  await ensureTables();
  if (value === undefined) {
    const r = await prisma.$queryRaw`SELECT value FROM outreach.meta WHERE key = ${key}`;
    return r[0] ? r[0].value : null;
  }
  await prisma.$executeRaw`INSERT INTO outreach.meta (key, value) VALUES (${key}, ${String(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
const isEnabled = async () => (await meta("institute_drip_enabled")) === "1";
const setEnabled = (on) => meta("institute_drip_enabled", on ? "1" : "0");

// Where this API is reachable from outside (for the unsubscribe link). Set
// API_PUBLIC_URL, or it is remembered from the admin page's own requests.
async function apiOrigin() {
  return (process.env.API_PUBLIC_URL || (await meta("api_origin")) || "https://appapi.yneet.in").replace(/\/$/, "");
}
async function rememberOrigin(req) {
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host || /localhost|127\.0\.0\.1/.test(host)) return;
  const origin = `https://${host}`;
  if ((await meta("api_origin")) !== origin) await meta("api_origin", origin);
}

// ── Unsubscribe token ──
const SECRET = () => process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || "yneet";
const unsubToken = (email) => crypto.createHmac("sha256", SECRET()).update(String(email).toLowerCase()).digest("hex").slice(0, 32);
const checkToken = (email, token) => {
  const a = Buffer.from(unsubToken(email));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const unsubUrl = (origin, email) => `${origin}/api/v1/public/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;

async function unsubscribe(email, token) {
  email = String(email || "").trim().toLowerCase();
  if (!email || !checkToken(email, token)) return false;
  await ensureTables();
  await prisma.$executeRaw`UPDATE outreach.institute_leads SET status = 'unsubscribed' WHERE email = ${email}`;
  return true;
}

// ── The emails ──
const link = (path, step) => {
  const [p, hash] = path.split("#");
  return `${SITE}${p}${p.includes("?") ? "&" : "?"}utm_source=email&utm_medium=institute_drip&utm_campaign=inst${step}${hash ? "#" + hash : ""}`;
};
const firstName = (name) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  // Keep a title with the name: "Dr. Ramesh", "Mrs Lakshmi".
  return /^(dr|mr|mrs|ms|prof|sri|smt|shri)\.?$/i.test(w[0] || "") && w[1] ? `${w[0]} ${w[1]}` : w[0] || "";
};
const hi = (l) => (firstName(l.name) ? `Dear ${firstName(l.name)},` : l.kind === "school" ? "Dear Principal," : "Dear Sir/Madam,");
const at = (l) => (l.institute ? ` at ${l.institute}` : "");
const students = (l) => (l.kind === "school" ? "your Class 9–12 students" : "your NEET students");

// gapDays = days after the previous email.
const STEPS = [
  {
    step: 1,
    gapDays: 0,
    subject: (l) => `Free 14-day NEET test pilot for ${l.institute || "your students"}`,
    body: (l) => `${hi(l)}

I'm Akbar from YNeet (yneet.in), an online NEET practice platform.

I'd like to offer ${students(l)}${at(l)} a free 14-day pilot for 5 students. No payment, no card.

What they get:
- Full 720-mark NEET mock tests, plus chapter tests in Physics, Chemistry, Botany and Zoology
- NEET previous-year questions (2016–2026) with answers and explanations
- Instant results: score, estimated rank and weakest chapters
- A mistake notebook so they revise exactly what they got wrong

And you get an institute panel showing every student's progress live.${l.kind === "school" ? "\n\nClass 6–10 school-level tests are included too, and Class 6–8 students are free (they don't use a seat)." : ""}

Start the free pilot (ready in about a minute):
${link("/institutes", 1)}

Or reply to this email and I'll set it up for you.

— Akbar
YNeet · Raise Academy
WhatsApp: +91 94434 24064`,
  },
  {
    step: 2,
    gapDays: 3,
    subject: () => "Which chapters are your students weakest in?",
    body: (l) => `${hi(l)}

A quick follow-up on the YNeet pilot.

Most institutes only see a total mark after a test. With YNeet's institute panel you see, for every student and the whole batch:

- which chapters they keep losing marks in
- who has stopped practising this week (send them a WhatsApp nudge in one tap)
- scores and estimated rank over time, downloadable as Excel

Parents also get a weekly progress report by email, so you get fewer "how is my child doing?" calls.

You can swap students any time, so the 5 pilot seats can go to whoever needs them most.

Try it free for 14 days:
${link("/institutes", 2)}

— Akbar, YNeet`,
  },
  {
    step: 3,
    gapDays: 5,
    subject: () => "YNeet for institutes: about ₹150 a student a month",
    body: (l) => `${hi(l)}

In case it helps to see the prices before you try it, here is what YNeet costs for an institute (no GST):

Monthly, paid online:
- 20 students: ₹3,999 a month
- 50 students: ₹8,999 a month
- 100 students: ₹14,999 a month

Yearly packs (about 8 months' price, by bank transfer, UPI or cheque):
- 20 students: ₹31,999 a year
- 50 students: ₹69,999 a year
- 100 students: ₹1,19,999 a year (₹1,200 a student)

The 14-day pilot is still free, and any pilot days left over are kept when you choose a plan:
${link("/institutes#pricing", 3)}

Also free, with no sign-up: NEET question-of-the-day and chapter-weightage widgets for your institute's website.
${link("/neet-question-widget", 3)}

— Akbar, YNeet`,
  },
  {
    step: 4,
    gapDays: 7,
    subject: () => "Shall I set up the pilot for you?",
    body: (l) => `${hi(l)}

Akbar here, from YNeet.

If you'd like to try YNeet${at(l)} but haven't had time, send me 5 student names and phone numbers (reply here or on WhatsApp) and I'll set up your free 14-day pilot myself:
${WA}?text=${encodeURIComponent("Hi Akbar, please set up the YNeet pilot for our institute.")}

If it's not for you, no problem at all. This is my last email about it.

— Akbar
YNeet · www.yneet.in`,
  },
];

const footer = (origin, l) =>
  `\n\n---\nYou're receiving this because ${l.institute || "your institute"}'s contact details are publicly listed and we thought YNeet might help your students.\nDon't want these emails? Unsubscribe: ${unsubUrl(origin, l.email)}`;

async function send(to, subject, text, origin) {
  if (!KEY()) throw new Error("RESEND_API_KEY is not set");
  const { error } = await getResend().emails.send({
    from: FROM(),
    to: [to],
    replyTo: REPLY_TO(),
    subject,
    text,
    headers: { "List-Unsubscribe": `<${unsubUrl(origin, to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (error) throw new Error(error.message || "Resend error");
}

// Leads due for a step right now.
async function dueFor(s, limit) {
  await ensureTables();
  const prev = s.step - 1;
  return prisma.$queryRawUnsafe(
    `SELECT l.* FROM outreach.institute_leads l
     WHERE l.status = 'active'
       AND ${prev === 0 ? "TRUE" : `EXISTS (SELECT 1 FROM outreach.institute_drip d WHERE d.lead_id = l.id AND d.step = ${prev}
             AND d.status = 'sent' AND d.sent_at <= NOW() - INTERVAL '${s.gapDays} days')`}
       AND NOT EXISTS (SELECT 1 FROM outreach.institute_drip d WHERE d.lead_id = l.id AND d.step = $1)
       AND NOT EXISTS (SELECT 1 FROM outreach.institute_drip d WHERE d.lead_id = l.id AND d.status = 'failed')
     ORDER BY l.id LIMIT $2`,
    s.step,
    limit,
  );
}

// "Today" in India time, so the daily cap resets at IST midnight.
async function sentToday() {
  await ensureTables();
  const r = await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM outreach.institute_drip
    WHERE sent_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
  return r[0].c;
}
const istHour = () => Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })) % 24;

let running = false;
async function tick() {
  if (running || !KEY() || !(await isEnabled())) return;
  const h = istHour();
  if (h < 9 || h >= 19) return;
  running = true;
  try {
    const origin = await apiOrigin();
    let budget = Math.min(PER_TICK, DAILY_CAP() - (await sentToday()));
    // Later steps first, so people already in the sequence keep their rhythm.
    for (const s of [...STEPS].reverse()) {
      if (budget <= 0) break;
      for (const lead of await dueFor(s, budget)) {
        try {
          await send(lead.email, s.subject(lead), s.body(lead) + footer(origin, lead), origin);
          await prisma.$executeRaw`INSERT INTO outreach.institute_drip (lead_id, step) VALUES (${lead.id}, ${s.step}) ON CONFLICT DO NOTHING`;
        } catch (err) {
          const msg = String(err.message || err).slice(0, 200);
          await prisma.$executeRaw`INSERT INTO outreach.institute_drip (lead_id, step, status, error) VALUES (${lead.id}, ${s.step}, 'failed', ${msg}) ON CONFLICT DO NOTHING`;
          console.error(`[InstituteDrip] email ${s.step} to ${lead.email} failed: ${msg}`);
        }
        budget -= 1;
        await new Promise((r) => setTimeout(r, 700)); // Resend: max 2 requests/second
      }
    }
  } finally {
    running = false;
  }
}

function startInstituteDrip() {
  setInterval(() => tick().catch((e) => console.error("[InstituteDrip]", e.message)), 20 * 60 * 1000).unref();
  setTimeout(() => tick().catch((e) => console.error("[InstituteDrip]", e.message)), 2 * 60 * 1000).unref();
}

const SAMPLE = { email: "principal@example.com", name: "Ramesh Kumar", institute: "Sri Vidya NEET Academy", city: "Madurai", kind: "coaching" };

async function sendTest(to) {
  const origin = await apiOrigin();
  for (const s of STEPS) {
    const l = { ...SAMPLE, email: to };
    await send(to, `[TEST] ${s.subject(l)}`, s.body(l) + footer(origin, l), origin);
    await new Promise((r) => setTimeout(r, 700));
  }
}

// CSV with a header row (email, and optionally name / institute / city / type),
// or plain lines of "email" / "name,email". Quoted cells are handled.
function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function importCsv(text, defaultKind) {
  await ensureTables();
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { added: 0, skipped: 0 };
  const head = parseLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const emailCol = col("email", "e-mail", "mail");
  const hasHeader = emailCol !== -1 && !EMAIL_RE.test(parseLine(lines[0])[emailCol] || "");
  const instCol = hasHeader ? col("institute", "school", "coaching", "centre", "center", "organisation", "organization", "company", "business") : -1;
  const nameCol = hasHeader ? head.findIndex((h, i) => i !== instCol && (h.includes("contact") || h.includes("owner") || h.includes("principal") || h === "name" || h.includes("person"))) : -1;
  const cityCol = hasHeader ? col("city", "town", "district", "location") : -1;
  const kindCol = hasHeader ? col("type", "kind", "category") : -1;
  const rows = hasHeader ? lines.slice(1) : lines;
  const kindOf = (v) => (/school/i.test(v || "") ? "school" : /coach|institute|academy|centre|center|tuition/i.test(v || "") ? "coaching" : null);

  let added = 0;
  let skipped = 0;
  for (const line of rows) {
    const c = parseLine(line);
    const email = ((hasHeader ? c[emailCol] : c.find((x) => x.includes("@"))) || "").toLowerCase();
    if (!EMAIL_RE.test(email)) { skipped += 1; continue; }
    const name = (hasHeader ? (nameCol >= 0 ? c[nameCol] : "") : c.find((x) => x && !x.includes("@")) || "").slice(0, 80);
    const institute = (instCol >= 0 ? c[instCol] || "" : "").slice(0, 120);
    const city = (cityCol >= 0 ? c[cityCol] || "" : "").slice(0, 60);
    const kind = kindOf(kindCol >= 0 ? c[kindCol] : "") || kindOf(institute) || (defaultKind === "school" ? "school" : "coaching");
    const n = await prisma.$executeRaw`INSERT INTO outreach.institute_leads (email, name, institute, city, kind)
      VALUES (${email}, ${name}, ${institute}, ${city}, ${kind}) ON CONFLICT (email) DO NOTHING`;
    if (n) added += 1; else skipped += 1;
  }
  return { added, skipped };
}

// Stop (bought / replied / not interested) or restart a lead, by email.
async function setLeadStatus(email, status, note) {
  await ensureTables();
  if (!["active", "stopped"].includes(status)) throw new Error("Bad status");
  return prisma.$executeRaw`UPDATE outreach.institute_leads SET status = ${status}, note = ${String(note || "").slice(0, 120)}
    WHERE email = ${String(email || "").trim().toLowerCase()} AND status <> 'unsubscribed'`;
}

async function recentLeads(q) {
  await ensureTables();
  const like = `%${String(q || "").trim().toLowerCase()}%`;
  return prisma.$queryRaw`SELECT l.id, l.email, l.name, l.institute, l.city, l.kind, l.status, l.note, l.created_at,
      COALESCE((SELECT MAX(step) FROM outreach.institute_drip d WHERE d.lead_id = l.id AND d.status = 'sent'), 0)::int AS last_step,
      (SELECT MAX(sent_at) FROM outreach.institute_drip d WHERE d.lead_id = l.id) AS last_sent,
      EXISTS (SELECT 1 FROM outreach.institute_drip d WHERE d.lead_id = l.id AND d.status = 'failed') AS bounced
    FROM outreach.institute_leads l
    WHERE ${like} = '%%' OR lower(l.email) LIKE ${like} OR lower(l.institute) LIKE ${like} OR lower(l.city) LIKE ${like} OR lower(l.name) LIKE ${like}
    ORDER BY l.id DESC LIMIT 50`;
}

async function stats() {
  await ensureTables();
  const [leads] = await prisma.$queryRaw`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status = 'stopped')::int AS stopped,
      COUNT(*) FILTER (WHERE status = 'unsubscribed')::int AS unsubscribed,
      COUNT(*) FILTER (WHERE kind = 'school')::int AS schools,
      COUNT(*) FILTER (WHERE kind = 'coaching')::int AS coaching
    FROM outreach.institute_leads`;
  const counts = await prisma.$queryRaw`SELECT step, status, COUNT(*)::int AS c FROM outreach.institute_drip GROUP BY step, status`;
  const count = (step, status) => counts.find((r) => r.step === step && r.status === status)?.c || 0;
  const origin = await apiOrigin();
  const steps = [];
  for (const s of STEPS) {
    steps.push({
      step: s.step,
      gapDays: s.gapDays,
      subject: s.subject(SAMPLE),
      preview: s.body(SAMPLE) + footer(origin, SAMPLE),
      sent: count(s.step, "sent"),
      failed: count(s.step, "failed"),
      dueNow: (await dueFor(s, 100000)).length,
    });
  }
  return {
    enabled: await isEnabled(),
    configured: !!KEY(),
    from: FROM(),
    replyTo: REPLY_TO(),
    dailyCap: DAILY_CAP(),
    sentToday: await sentToday(),
    leads,
    steps,
  };
}

module.exports = { STEPS, startInstituteDrip, tick, sendTest, setEnabled, isEnabled, stats, importCsv, setLeadStatus, recentLeads, unsubscribe, rememberOrigin, ensureTables };
