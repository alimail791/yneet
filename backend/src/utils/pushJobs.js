// Scheduled push notifications (India time):
//   07:00  Question of the Day                       → everyone with notifications on
//   18:00  "Your free trial ends in 3 days"          → trial users on day 27
//   19:00  "Today's 60-Second Sprint is waiting"     → anyone who hasn't played today
//   20:30  "Keep your streak" / "Your practice waits" → anyone who hasn't opened YNeet today
// A minute ticker checks the clock; push.job_runs makes each job run once a day,
// even across redeploys. A job only starts inside its 2-hour window, so a late
// deploy never sends a morning push at lunchtime.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const push = require("./push");

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istNow = () => new Date(Date.now() + IST_MS);
const istDay = () => istNow().toISOString().slice(0, 10);
const istMinutes = () => { const d = istNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const startOfIstToday = () => new Date(Date.parse(`${istDay()}T00:00:00Z`) - IST_MS);

const short = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

async function qotdJob() {
  const { questionFor } = require("../controllers/publicExtrasController")._internal;
  const q = await questionFor(istDay());
  if (!q) return;
  const rows = await push.allSubscriptions();
  const r = await push.sendTo(rows, {
    title: `Question of the Day · ${q.subject}`,
    body: short(q.question, 140),
    url: "/qotd",
    tag: "qotd",
  });
  console.log(`[push] QOTD: ${JSON.stringify(r)}`);
}

async function streakJob() {
  const rows = await push.allSubscriptions();
  if (!rows.length) return;
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const streaks = await prisma.streak.findMany({ where: { userId: { in: ids } }, select: { userId: true, current: true, lastActive: true } });
  const byUser = new Map(streaks.map((s) => [s.userId, s]));
  const today = startOfIstToday();
  const r = await push.sendTo(rows, (row) => {
    const s = byUser.get(row.user_id);
    if (s && new Date(s.lastActive) >= today) return null; // already studied today
    if (s && s.current >= 2) {
      return { title: `Don't lose your ${s.current}-day streak`, body: "A few questions tonight keeps it going. It takes 5 minutes.", url: "/", tag: "streak" };
    }
    return { title: "Your NEET practice is waiting", body: "Solve 10 questions before you sleep. Small steps every day add up.", url: "/", tag: "streak" };
  });
  console.log(`[push] streak: ${JSON.stringify(r)}`);
}

async function trialEndingJob() {
  const now = Date.now();
  const subs = await prisma.subscription.findMany({
    where: { plan: "TRIAL_30D", status: "active", endDate: { gt: new Date(now + 2 * DAY_MS), lte: new Date(now + 3 * DAY_MS) } },
    select: { userId: true },
  });
  if (!subs.length) return;
  const users = new Set(subs.map((s) => s.userId));
  const rows = (await push.allSubscriptions()).filter((r) => users.has(r.user_id));
  const r = await push.sendTo(rows, { title: "3 days left in your free trial", body: "Take a full mock test this week and see how ready you are.", url: "/mock", tag: "trial" });
  console.log(`[push] trial ending: ${JSON.stringify(r)}`);
}

async function sprintJob() {
  const S = require("./sprint");
  await S.ensureTables();
  const day = istDay();
  const played = new Set((await prisma.$queryRaw`SELECT user_id FROM sprint.plays WHERE day = ${day} AND finished_at IS NOT NULL`).map((r) => r.user_id));
  const rows = (await push.allSubscriptions()).filter((r) => !played.has(r.user_id));
  const r = await push.sendTo(rows, {
    title: "Today's 60-Second Sprint is waiting",
    body: "5 questions, 60 seconds. See where you rank today.",
    url: "/sprint",
    tag: "sprint",
  });
  console.log(`[push] sprint: ${JSON.stringify(r)}`);
}

const JOBS = [
  { name: "qotd", at: 7 * 60, run: qotdJob },
  { name: "trial", at: 18 * 60, run: trialEndingJob },
  { name: "sprint", at: 19 * 60, run: sprintJob },
  { name: "streak", at: 20 * 60 + 30, run: streakJob },
];

let busy = false;
async function tick() {
  if (busy || !push.enabled) return;
  busy = true;
  try {
    const m = istMinutes();
    for (const j of JOBS) {
      if (m < j.at || m >= j.at + 120) continue;
      if (!(await push.claimJob(j.name, istDay()))) continue;
      await j.run().catch((e) => console.warn(`[push] ${j.name} failed:`, e.message));
    }
  } catch (e) {
    console.warn("[push] tick failed:", e.message);
  } finally {
    busy = false;
  }
}

function startPushJobs() {
  if (!push.enabled) { console.log("[push] off: VAPID keys not set."); return; }
  push.ensureTables().then(() => console.log("[push] ready")).catch((e) => console.warn("[push] table setup failed:", e.message));
  setInterval(tick, 60 * 1000);
}

module.exports = { startPushJobs, qotdJob, streakJob, trialEndingJob, sprintJob };
