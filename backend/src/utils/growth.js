// Growth numbers for the admin "Growth" screen: are new students taking tests,
// do they come back, and are invites / challenges / the All-India mock working?
//
// Most numbers come straight from users / attempts / referrals / subscriptions.
// Things the database doesn't otherwise record (an invite shared on WhatsApp, a
// challenge link opened) are logged in a small growth.events table — created on
// first use like push.* and weekly.*, so no Prisma schema change.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const KINDS = ["invite_share", "challenge_share", "challenge_open", "challenge_start"];

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS growth`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS growth.events (
        id      BIGSERIAL PRIMARY KEY,
        kind    TEXT NOT NULL,
        user_id TEXT,
        ref     TEXT,
        at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS events_kind_at_idx ON growth.events (kind, at)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Best-effort: never let tracking break the real request.
async function logEvent(kind, userId = null, ref = null) {
  if (!KINDS.includes(kind)) return;
  try {
    await ensureTables();
    await prisma.$executeRaw`INSERT INTO growth.events (kind, user_id, ref) VALUES (${kind}, ${userId}, ${ref ? String(ref).slice(0, 64) : null})`;
  } catch (e) { console.warn("[growth] log failed:", e.message); }
}

const n = (v) => Number(v || 0);
const pct = (a, b) => (n(b) ? Math.round((n(a) / n(b)) * 1000) / 10 : null);

async function metrics() {
  await ensureTables();

  // Activation & return, on recent sign-ups (admins excluded).
  const [act] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE u."createdAt" >= NOW() - INTERVAL '30 days')::int AS "new30",
      COUNT(*) FILTER (WHERE u."createdAt" BETWEEN NOW() - INTERVAL '31 days' AND NOW() - INTERVAL '1 day')::int AS "cohort24",
      COUNT(*) FILTER (WHERE u."createdAt" BETWEEN NOW() - INTERVAL '31 days' AND NOW() - INTERVAL '1 day'
        AND EXISTS (SELECT 1 FROM attempts a WHERE a."userId" = u.id AND a.status = 'submitted' AND a."submittedAt" <= u."createdAt" + INTERVAL '1 day'))::int AS "first24",
      COUNT(*) FILTER (WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
        AND EXISTS (SELECT 1 FROM attempts a WHERE a."userId" = u.id AND a.status = 'submitted'))::int AS "anyTest30",
      COUNT(*) FILTER (WHERE u."createdAt" BETWEEN NOW() - INTERVAL '38 days' AND NOW() - INTERVAL '8 days')::int AS "cohort7",
      COUNT(*) FILTER (WHERE u."createdAt" BETWEEN NOW() - INTERVAL '38 days' AND NOW() - INTERVAL '8 days'
        AND EXISTS (SELECT 1 FROM attempts a WHERE a."userId" = u.id
          AND a."startedAt" > u."createdAt" + INTERVAL '1 day' AND a."startedAt" <= u."createdAt" + INTERVAL '7 days'))::int AS "back7"
    FROM users u WHERE u.role <> 'admin'`;

  const [week] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS tests, COUNT(DISTINCT "userId")::int AS students
    FROM attempts WHERE status = 'submitted' AND "submittedAt" >= NOW() - INTERVAL '7 days'`;

  // Last 8 weeks (Monday-start, India time).
  const weekly = await prisma.$queryRaw`
    WITH weeks AS (
      SELECT generate_series(date_trunc('week', NOW() + INTERVAL '330 minutes') - INTERVAL '7 weeks',
                             date_trunc('week', NOW() + INTERVAL '330 minutes'), INTERVAL '1 week') AS wk
    )
    SELECT to_char(w.wk, 'YYYY-MM-DD') AS week,
      (SELECT COUNT(*) FROM users u WHERE u.role <> 'admin' AND date_trunc('week', u."createdAt" + INTERVAL '330 minutes') = w.wk)::int AS signups,
      (SELECT COUNT(*) FROM attempts a WHERE a.status = 'submitted' AND date_trunc('week', a."submittedAt" + INTERVAL '330 minutes') = w.wk)::int AS tests,
      (SELECT COUNT(DISTINCT a."userId") FROM attempts a WHERE a.status = 'submitted' AND date_trunc('week', a."submittedAt" + INTERVAL '330 minutes') = w.wk)::int AS "activeStudents",
      (SELECT COUNT(*) FROM referrals r WHERE date_trunc('week', r."createdAt" + INTERVAL '330 minutes') = w.wk)::int AS "friendsJoined"
    FROM weeks w ORDER BY w.wk DESC`;

  // Invite & challenge funnel, last 30 days.
  const ev = await prisma.$queryRaw`
    SELECT kind, COUNT(*)::int AS c FROM growth.events WHERE at >= NOW() - INTERVAL '30 days' GROUP BY kind`;
  const evc = Object.fromEntries(ev.map((r) => [r.kind, n(r.c)]));
  const [ref] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS joined, COUNT(*) FILTER (WHERE "rewardGranted")::int AS confirmed,
           COUNT(DISTINCT "referrerId")::int AS referrers
    FROM referrals WHERE "createdAt" >= NOW() - INTERVAL '30 days'`;

  // All-India mock: ranked takers (first attempt started on the Sunday, India time).
  const allIndia = await prisma.$queryRaw`
    SELECT t.subject AS date, t.title,
      (SELECT COUNT(DISTINCT a."userId") FROM attempts a WHERE a."mockTestId" = t.id AND a.status = 'submitted'
         AND a."startedAt" >= (t.subject::date - INTERVAL '330 minutes') AND a."startedAt" < (t.subject::date + INTERVAL '1 day' - INTERVAL '330 minutes'))::int AS ranked,
      (SELECT COUNT(*) FROM attempts a WHERE a."mockTestId" = t.id AND a.status = 'submitted')::int AS attempts
    FROM mock_tests t WHERE t.type = 'allindia' ORDER BY t.subject DESC LIMIT 8`;

  // Who is on which plan right now.
  const [plans] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE active AND s.plan = 'TRIAL_30D')::int AS trial,
      COUNT(*) FILTER (WHERE active AND s.plan = 'INSTITUTE')::int AS institute,
      COUNT(*) FILTER (WHERE active AND s.plan = 'REFERRAL_FREE')::int AS "referralFree",
      COUNT(*) FILTER (WHERE active AND s.plan NOT IN ('TRIAL_30D','INSTITUTE','REFERRAL_FREE') AND COALESCE(s.amount, 0) > 0)::int AS paid,
      COUNT(*) FILTER (WHERE NOT active AND p.class NOT IN ('6th','7th','8th'))::int AS "freeTier",
      COUNT(*) FILTER (WHERE NOT active AND p.class IN ('6th','7th','8th'))::int AS "juniorFree",
      COUNT(*) FILTER (WHERE NOT active AND p.class NOT IN ('6th','7th','8th') AND EXISTS (
        SELECT 1 FROM attempts a WHERE a."userId" = u.id AND a.status = 'submitted' AND a."submittedAt" >= NOW() - INTERVAL '7 days'))::int AS "freeTierActive7"
    FROM users u
    LEFT JOIN profiles p ON p."userId" = u.id
    LEFT JOIN subscriptions s ON s."userId" = u.id
    CROSS JOIN LATERAL (SELECT (s.status = 'active' AND s."endDate" > NOW()) IS TRUE AS active) x
    WHERE u.role <> 'admin'`;

  return {
    activation: {
      newStudents30: n(act.new30),
      firstTest24hPct: pct(act.first24, act.cohort24), firstTest24h: n(act.first24), cohort24: n(act.cohort24),
      anyTest30Pct: pct(act.anyTest30, act.new30),
      back7Pct: pct(act.back7, act.cohort7), back7: n(act.back7), cohort7: n(act.cohort7),
    },
    last7: { tests: n(week.tests), students: n(week.students), testsPerStudent: n(week.students) ? Math.round((n(week.tests) / n(week.students)) * 10) / 10 : 0 },
    weekly: weekly.map((w) => ({ week: w.week, signups: n(w.signups), tests: n(w.tests), activeStudents: n(w.activeStudents), friendsJoined: n(w.friendsJoined) })),
    funnel: {
      inviteShares: evc.invite_share || 0, challengeShares: evc.challenge_share || 0,
      challengeOpens: evc.challenge_open || 0, challengeStarts: evc.challenge_start || 0,
      friendsJoined: n(ref.joined), friendsConfirmed: n(ref.confirmed), referrers: n(ref.referrers),
    },
    allIndia: allIndia.map((r) => ({ date: r.date, title: r.title, ranked: n(r.ranked), attempts: n(r.attempts) })),
    plans: Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, n(v)])),
  };
}

module.exports = { KINDS, logEvent, metrics, ensureTables };
