// Web push notifications (also used by the Play Store app, which shows them as
// native Android notifications through Chrome's notification delegation).
//
// Storage: push subscriptions live in their own Postgres schema, "push",
// created here with plain SQL. They are deliberately NOT in prisma/schema.prisma:
// the deploy runs `prisma db push` on the public schema only, so this table is
// never touched (or dropped) by it, and the Prisma schema stays unchanged.
//
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (https://www.yneet.in).
// Without the keys, push is simply switched off.
const { PrismaClient } = require("@prisma/client");
const webpush = require("web-push");
const prisma = new PrismaClient();

const enabled = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://www.yneet.in",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

let ready = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS push`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS push.subscriptions (
        endpoint   TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        in_app     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_sent  TIMESTAMPTZ
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON push.subscriptions (user_id)`);
      // One row per scheduled job, so a redeploy never sends the same day's push twice.
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS push.job_runs (
        job      TEXT PRIMARY KEY,
        last_day TEXT NOT NULL
      )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

async function saveSubscription(userId, sub, inApp) {
  await ensureTables();
  const { endpoint, keys } = sub || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error("Invalid subscription");
  if (!/^https:\/\//.test(endpoint)) throw new Error("Invalid endpoint");
  await prisma.$executeRaw`
    INSERT INTO push.subscriptions (endpoint, user_id, p256dh, auth, in_app)
    VALUES (${endpoint}, ${userId}, ${keys.p256dh}, ${keys.auth}, ${!!inApp})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth, in_app = EXCLUDED.in_app`;
}

async function removeSubscription(endpoint) {
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM push.subscriptions WHERE endpoint = ${endpoint}`;
}

async function removeUserSubscriptions(userId) {
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM push.subscriptions WHERE user_id = ${userId}`;
}

// rows: [{ endpoint, user_id, p256dh, auth, in_app }]
// payload: { title, body, url, tag } or a function (row) => payload | null
async function sendTo(rows, payload) {
  if (!enabled) return { sent: 0, failed: 0, removed: 0 };
  let sent = 0, failed = 0, removed = 0;
  const queue = rows.slice();
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift();
      const p = typeof payload === "function" ? payload(r) : payload;
      if (!p) continue;
      // Taps open the right page; inside the Play Store app the page keeps app mode.
      const url = p.url ? p.url + (r.in_app ? (p.url.includes("?") ? "&" : "?") + "app=1" : "") : undefined;
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ ...p, url }),
          { TTL: 6 * 60 * 60 },
        );
        sent++;
        prisma.$executeRaw`UPDATE push.subscriptions SET last_sent = NOW() WHERE endpoint = ${r.endpoint}`.catch(() => {});
      } catch (err) {
        // 404/410 = the person turned notifications off or uninstalled: forget it.
        if (err.statusCode === 404 || err.statusCode === 410) {
          removed++;
          await removeSubscription(r.endpoint).catch(() => {});
        } else {
          failed++;
          console.warn("push failed:", err.statusCode || "", err.body || err.message);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 10 }, worker));
  return { sent, failed, removed };
}

async function allSubscriptions() {
  await ensureTables();
  return prisma.$queryRaw`SELECT endpoint, user_id, p256dh, auth, in_app FROM push.subscriptions`;
}

// Same rows plus the student's class (null if no profile yet).
async function allSubscriptionsWithClass() {
  await ensureTables();
  return prisma.$queryRaw`SELECT s.endpoint, s.user_id, s.p256dh, s.auth, s.in_app, pr.class AS cls
    FROM push.subscriptions s LEFT JOIN profiles pr ON pr."userId" = s.user_id`;
}

async function subscriptionsForUser(userId) {
  await ensureTables();
  return prisma.$queryRaw`SELECT endpoint, user_id, p256dh, auth, in_app FROM push.subscriptions WHERE user_id = ${userId}`;
}

async function countSubscriptions() {
  await ensureTables();
  const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS devices, COUNT(DISTINCT user_id)::int AS users,
    COUNT(*) FILTER (WHERE in_app)::int AS app_devices FROM push.subscriptions`;
  return rows[0];
}

// Returns true the first time it is called for (job, day); false after that.
async function claimJob(job, day) {
  await ensureTables();
  const n = await prisma.$executeRaw`
    INSERT INTO push.job_runs (job, last_day) VALUES (${job}, ${day})
    ON CONFLICT (job) DO UPDATE SET last_day = EXCLUDED.last_day WHERE push.job_runs.last_day <> EXCLUDED.last_day`;
  return n > 0;
}

module.exports = {
  enabled, ensureTables, saveSubscription, removeSubscription, removeUserSubscriptions,
  sendTo, allSubscriptions, allSubscriptionsWithClass, subscriptionsForUser, countSubscriptions, claimJob,
};
