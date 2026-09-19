// One-off cleanup script — deletes every row in the User table (and everything
// that cascades from it: Profile, Subscription, Streak, XP, Attempt,
// AttemptResponse, Mistake, PracticeStat, QuizItem, UserBadge, Referral).
// Run this ONCE to clear out leftover test/dev data that predates this
// project being handed over — every real student gets freshly and correctly
// re-provisioned the next time they click through from Raise Academy.
//
// Usage: node scripts_clearUsers.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const countBefore = await prisma.user.count();
  console.log(`Found ${countBefore} user(s). Deleting...`);
  const result = await prisma.user.deleteMany({});
  console.log(`Deleted ${result.count} user(s) and all their related data.`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("Cleanup failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
