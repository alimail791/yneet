const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Institute bulk packs (bought offline, managed on Raise Academy). A student an
// institute has added gets plan "INSTITUTE" until the institute's end date.
// Removing them (or the pack lapsing/being suspended) ends it — but never touches
// a plan the student paid for themselves.
async function applyInstituteAccess(userId, active, endDate) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return null;
  const now = new Date();
  if (active && endDate) {
    const end = new Date(endDate);
    const ownActive = sub.plan !== "INSTITUTE" && sub.status === "active" && sub.endDate && sub.endDate > now;
    if (ownActive && sub.endDate >= end) return sub; // their own plan already runs longer
    if (sub.plan === "INSTITUTE" && sub.status === "active" && sub.endDate && +sub.endDate === +end) return sub;
    return prisma.subscription.update({
      where: { userId },
      data: { plan: "INSTITUTE", status: "active", startDate: sub.plan === "INSTITUTE" && sub.startDate ? sub.startDate : now, endDate: end, amount: 0, expiryReminderSent: false },
    });
  }
  if (sub.plan === "INSTITUTE" && sub.status === "active") {
    return prisma.subscription.update({ where: { userId }, data: { status: "expired", endDate: now } });
  }
  return sub;
}

module.exports = { applyInstituteAccess };
