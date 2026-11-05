// Refer & Earn: every friend who joins with a student's link earns that student
// REFERRAL_DAYS free days (2 friends = 1 month). A friend counts once they are
// a real student: they confirmed their WhatsApp number / email in YNeet, or they
// paid for a plan. Each referral pays out once (Referral.rewardGranted).
//
// Referral.qualified / rewardGranted are reused as-is (no schema change):
// qualified = friend is verified or paid; rewardGranted = days were added.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const REFERRAL_DAYS = 15;
const DAY = 24 * 60 * 60 * 1000;

// Adds `days` on top of the student's current plan. An active plan keeps its
// name and just runs longer; an expired or missing one becomes REFERRAL_FREE.
async function addFreeDays(userId, days) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const now = new Date();
  const active = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > now;
  if (active) {
    return prisma.subscription.update({
      where: { userId },
      data: { endDate: new Date(new Date(sub.endDate).getTime() + days * DAY), expiryReminderSent: false },
    });
  }
  const data = { plan: "REFERRAL_FREE", status: "active", startDate: now, endDate: new Date(now.getTime() + days * DAY), amount: 0, expiryReminderSent: false };
  return prisma.subscription.upsert({ where: { userId }, update: data, create: { userId, ...data } });
}

// Call when the referred student verifies or pays. Safe to call many times.
async function grantReferralReward(referredUserId) {
  const ref = await prisma.referral.findUnique({ where: { referredId: referredUserId } });
  if (!ref || ref.rewardGranted) return false;
  // Claim the reward atomically so two calls at once can't both pay out.
  const claimed = await prisma.referral.updateMany({
    where: { id: ref.id, rewardGranted: false },
    data: { qualified: true, rewardGranted: true },
  });
  if (claimed.count === 0) return false;
  try {
    await addFreeDays(ref.referrerId, REFERRAL_DAYS);
  } catch (e) {
    await prisma.referral.update({ where: { id: ref.id }, data: { rewardGranted: false } }).catch(() => {});
    throw e;
  }
  return true;
}

module.exports = { REFERRAL_DAYS, grantReferralReward };
