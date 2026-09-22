// Simple in-process daily scheduler — no separate cron infrastructure needed
// since this backend runs as a long-lived Node process on Railway (not
// serverless). Runs once shortly after startup, then every 24 hours.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendExpiryReminder, sendParentDigest } = require("./mailer");

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
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const profiles = await prisma.profile.findMany({
    where: {
      parentEmail: { not: null },
      OR: [{ lastParentDigestSent: null }, { lastParentDigestSent: { lt: weekAgo } }],
    },
    include: {
      user: {
        select: {
          name: true,
          streak: { select: { current: true } },
          _count: { select: { attempts: { where: { status: "submitted" } } } },
        },
      },
    },
  });

  for (const p of profiles) {
    try {
      await sendParentDigest(p.parentEmail, p.user, {
        currentScore: p.currentScore,
        targetScore: p.targetScore,
        streak: p.user.streak?.current || 0,
        mockCount: p.user._count.attempts,
        weakSubjects: p.weakSubjects,
      });
      await prisma.profile.update({ where: { id: p.id }, data: { lastParentDigestSent: new Date() } });
      console.log(`Parent digest sent to ${p.parentEmail}`);
    } catch (err) {
      console.warn(`Failed to send parent digest to ${p.parentEmail}:`, err.message);
    }
  }
}

async function runDailyJobs() {
  if (!process.env.RESEND_API_KEY) {
    console.log("Skipping scheduled emails — RESEND_API_KEY not configured.");
    return;
  }
  await checkExpiringSubscriptions().catch((e) => console.warn("checkExpiringSubscriptions failed:", e.message));
  await sendParentDigests().catch((e) => console.warn("sendParentDigests failed:", e.message));
}

function startScheduledJobs() {
  // Wait 2 minutes after boot before the first run (let the server fully
  // settle, avoid racing DB connection setup), then repeat every 24 hours.
  setTimeout(() => {
    runDailyJobs();
    setInterval(runDailyJobs, DAY_MS);
  }, 2 * 60 * 1000);
}

module.exports = { startScheduledJobs };
