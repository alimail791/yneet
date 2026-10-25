const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { _internal: { creatorView } } = require("./creatorController");
const { generatePayouts, lastWeekEnd } = require("../utils/creatorPayouts");

// GET /api/v1/admin/creators — every creator with their Short counts and money owed.
exports.listCreators = async (req, res) => {
  try {
    const creators = await prisma.creator.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
    const [counts, unpaid, views] = await Promise.all([
      prisma.short.groupBy({ by: ["creatorId", "reviewStatus"], where: { creatorId: { not: null } }, _count: { _all: true } }),
      prisma.short.groupBy({ by: ["creatorId"], where: { creatorId: { not: null }, reviewStatus: "approved", payoutId: null }, _sum: { payAmount: true } }),
      prisma.short.groupBy({ by: ["creatorId"], where: { creatorId: { not: null } }, _sum: { viewCount: true } }),
    ]);
    res.json({
      success: true,
      creators: creators.map(c => {
        const mine = counts.filter(x => x.creatorId === c.id);
        const n = (st) => mine.find(x => x.reviewStatus === st)?._count._all || 0;
        return {
          ...creatorView(c),
          shorts: { approved: n("approved"), pending: n("pending"), rejected: n("rejected") },
          unpaidAmount: unpaid.find(x => x.creatorId === c.id)?._sum.payAmount || 0,
          viewers: views.find(x => x.creatorId === c.id)?._sum.viewCount || 0,
        };
      }),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/v1/admin/creators/:id  { status?, ratePerVideo? }
exports.updateCreator = async (req, res) => {
  try {
    const data = {};
    if (req.body.status !== undefined) {
      if (!["pending", "approved", "suspended"].includes(req.body.status)) return res.status(400).json({ success: false, message: "Invalid status" });
      data.status = req.body.status;
    }
    if (req.body.ratePerVideo !== undefined) {
      const r = Number(req.body.ratePerVideo);
      if (!Number.isInteger(r) || r < 0 || r > 100000) return res.status(400).json({ success: false, message: "Rate must be whole rupees" });
      data.ratePerVideo = r;
    }
    const creator = await prisma.creator.update({ where: { id: req.params.id }, data });
    res.json({ success: true, creator: creatorView(creator) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// POST /api/v1/admin/creators/:id/reset-password — returns a temporary password
// for the admin to send the creator on WhatsApp (they can change it in their profile).
exports.resetCreatorPassword = async (req, res) => {
  try {
    const temp = crypto.randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).padEnd(8, "7");
    const creator = await prisma.creator.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
    res.json({ success: true, tempPassword: temp, email: creator.email, phone: creator.phone });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

// GET /api/v1/admin/payouts?status=pending|paid
exports.listPayouts = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const payouts = await prisma.creatorPayout.findMany({
      where, orderBy: [{ status: "asc" }, { periodEnd: "desc" }], take: 200,
      include: { creator: { select: { id: true, name: true, phone: true, upiId: true } } },
    });
    res.json({ success: true, payouts, nextWeekEnd: lastWeekEnd() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/v1/admin/payouts/generate  { upToNow?: boolean }
// Normally runs by itself every Monday (see scheduledJobs). By default it bundles
// Shorts approved up to the end of last week; upToNow includes this week too.
exports.generatePayoutsNow = async (req, res) => {
  try {
    const created = await generatePayouts(req.body?.upToNow ? new Date() : lastWeekEnd());
    res.json({ success: true, created: created.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/v1/admin/payouts/:id  { status?: "paid" | "pending", reference?, bonus? }
exports.updatePayout = async (req, res) => {
  try {
    const data = {};
    if (req.body.bonus !== undefined) {
      const b = Number(req.body.bonus);
      if (!Number.isInteger(b) || b < 0) return res.status(400).json({ success: false, message: "Bonus must be whole rupees" });
      data.bonus = b;
    }
    if (req.body.reference !== undefined) data.reference = String(req.body.reference || "").trim().slice(0, 120) || null;
    if (req.body.status === "paid") { data.status = "paid"; data.paidAt = new Date(); }
    if (req.body.status === "pending") { data.status = "pending"; data.paidAt = null; }
    const payout = await prisma.creatorPayout.update({
      where: { id: req.params.id }, data,
      include: { creator: { select: { id: true, name: true, phone: true, upiId: true } } },
    });
    res.json({ success: true, payout });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};
