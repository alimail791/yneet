// Simple in-process daily scheduler — no separate cron infrastructure needed
// since this backend runs as a long-lived Node process on Railway (not
// serverless). Runs once shortly after startup, then every 24 hours.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendExpiryReminder, sendParentDigest, sendInactivityReminder } = require("./mailer");

const DAY_MS = 24 * 60 * 60 * 1000;

async function checkExpiringSubscriptions() {
  const in3Days = new Date(Date.now() + 3 * DAY_MS);
  const expiring = await prisma.subscription.findMany({
    where: {
      status: "active",
      expiryReminderSent: false,
      endDate: { lte: in3Days, gt: new Date() },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  for (const sub of expiring) {
    const daysLeft = Math.max(1, Math.ceil((new Date(sub.endDate) - Date.now()) / DAY_MS));
    try {
      await sendExpiryReminder(sub.user, daysLeft);
      await prisma.subscription.update({ where: { id: sub.id }, data: { expiryReminderSent: true } });
      console.log(`Expiry reminder sent to ${sub.user.email} (${daysLeft}d left)`);
    } catch (err) {
      console.warn(`Failed to send expiry reminder to ${sub.user.email}:`, err.message);
    }
  }
}

async function sendParentDigests() {
  const { buildParentReport } = require("./parentReport");
  const weekAgo = new Date(Date.now() - 7 * DAY_MS + 60 * 60 * 1000); // 1h slack so the daily run doesn't drift past a week
  const profiles = await prisma.profile.findMany({
    where: {
      parentEmail: { not: null },
      OR: [{ lastParentDigestSent: null }, { lastParentDigestSent: { lt: weekAgo } }],
    },
    select: { id: true, userId: true, parentEmail: true },
  });

  for (const p of profiles) {
    try {
      const stats = await buildParentReport(p.userId);
      if (!stats) continue;
      await sendParentDigest(p.parentEmail, stats);
      await prisma.profile.update({ where: { id: p.id }, data: { lastParentDigestSent: new Date() } });
      console.log(`Parent digest sent to ${p.parentEmail}`);
    } catch (err) {
      console.warn(`Failed to send parent digest to ${p.parentEmail}:`, err.message);
    }
  }
}

// Emails students whose last visit (Streak.lastActive, kept fresh by the auth
// middleware) was 5-6 days ago. The one-day window means each absent student
// is emailed once, on the daily run that first catches them at 5 days away;
// a guard keeps a same-day restart from running the job twice.
let lastInactivityRun = 0;
async function sendInactivityEmails() {
  if (Date.now() - lastInactivityRun < 20 * 60 * 60 * 1000) return;
  lastInactivityRun = Date.now();
  const streaks = await prisma.streak.findMany({
    where: {
      lastActive: { lte: new Date(Date.now() - 5 * DAY_MS), gt: new Date(Date.now() - 6 * DAY_MS) },
    },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const s of streaks) {
    try {
      await sendInactivityReminder(s.user);
      console.log(`Inactivity reminder sent to ${s.user.email}`);
    } catch (err) {
      console.warn(`Failed to send inactivity reminder to ${s.user.email}:`, err.message);
    }
  }
}

async function runDailyJobs() {
  // Mondays: settle last week's approved creator Shorts into pending payouts.
  // Doesn't depend on email, so it runs before the RESEND check below.
  const istDay = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCDay();
  if (istDay === 1) {
    try {
      const created = await require("./creatorPayouts").generatePayouts();
      if (created.length) console.log(`Creator payouts: ${created.length} created for last week.`);
    } catch (e) { console.warn("Creator payouts failed:", e.message); }
  }
  if (!process.env.RESEND_API_KEY) {
    console.log("Skipping scheduled emails — RESEND_API_KEY not configured.");
    return;
  }
  await checkExpiringSubscriptions().catch((e) => console.warn("checkExpiringSubscriptions failed:", e.message));
  await sendInactivityEmails().catch((e) => console.warn("sendInactivityEmails failed:", e.message));
  await sendParentDigests().catch((e) => console.warn("sendParentDigests failed:", e.message));
}

// Runs once a day at 10:00 IST (04:30 UTC) — a fixed time, not "2 minutes after
// boot", so redeploys don't send extra emails (the inactivity reminder has no
// "already sent" flag and was going out again on every deploy).
const RUN_AT_UTC_MIN = 4 * 60 + 30;
function msUntilNextRun(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(0, RUN_AT_UTC_MIN, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next - now;
}

function startScheduledJobs() {
  const schedule = () => setTimeout(async () => {
    await runDailyJobs().catch((e) => console.warn("Daily jobs failed:", e.message));
    schedule();
  }, msUntilNextRun());
  schedule();
  console.log(`Daily email jobs scheduled — next run in ${Math.round(msUntilNextRun() / 60000)} min (10:00 IST).`);
}

module.exports = { startScheduledJobs };
