const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Weeks run Monday 00:00 → Sunday 23:59 IST. Returns the UTC instant of the most
// recent Monday 00:00 IST at or before `now` (i.e. the end of last week).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function lastWeekEnd(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const mondayIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday);
  return new Date(mondayIst - IST_OFFSET_MS);
}

// Bundles every approved, unpaid Short (approved before `until`) into one
// pending payout per creator. Safe to run repeatedly: a Short joins only one payout.
async function generatePayouts(until = lastWeekEnd()) {
  const due = await prisma.short.findMany({
    where: { creatorId: { not: null }, reviewStatus: "approved", payoutId: null, approvedAt: { lt: until } },
    select: { id: true, creatorId: true, payAmount: true, approvedAt: true },
  });
  const byCreator = new Map();
  for (const s of due) {
    if (!byCreator.has(s.creatorId)) byCreator.set(s.creatorId, []);
    byCreator.get(s.creatorId).push(s);
  }

  const created = [];
  for (const [creatorId, shorts] of byCreator) {
    const payout = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so two runs can't claim the same Shorts.
      const fresh = await tx.short.findMany({ where: { id: { in: shorts.map(s => s.id) }, payoutId: null }, select: { id: true, payAmount: true, approvedAt: true } });
      if (!fresh.length) return null;
      const p = await tx.creatorPayout.create({
        data: {
          creatorId,
          periodStart: new Date(Math.min(...fresh.map(s => +s.approvedAt))),
          periodEnd: until,
          videoCount: fresh.length,
          amount: fresh.reduce((sum, s) => sum + (s.payAmount || 0), 0),
        },
      });
      await tx.short.updateMany({ where: { id: { in: fresh.map(s => s.id) } }, data: { payoutId: p.id } });
      return p;
    });
    if (payout) created.push(payout);
  }
  return created;
}

module.exports = { generatePayouts, lastWeekEnd };
