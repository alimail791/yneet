const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Server-to-server only: YNeet Daily (play.yneet.in) calls this when a player
// has brought 3 friends and earned a free month. Shared GAMES_SERVICE_KEY.
router.use((req, res, next) => {
  const key = req.headers["x-games-key"];
  if (!process.env.GAMES_SERVICE_KEY || key !== process.env.GAMES_SERVICE_KEY) return res.status(401).json({ success: false, message: "Unauthorized" });
  next();
});

const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// POST /api/v1/games/bonus-month  { phone, days? }
// Finds the YNeet student with this WhatsApp number and adds the free days on top
// of whatever plan they have (stacked after an active plan, else from today).
// If the student has not opened YNeet yet there is no row here; the caller
// retries later, after they sign up on www.yneet.in with the same number.
router.post("/bonus-month", async (req, res) => {
  try {
    const phone = last10(req.body?.phone);
    const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 30, 1), 90);
    if (phone.length !== 10) return res.status(400).json({ success: false, message: "A 10-digit phone is required" });

    const candidates = await prisma.user.findMany({
      where: { phone: { contains: phone.slice(-4) } },
      include: { subscription: true },
      orderBy: { updatedAt: "desc" },
    });
    const user = candidates.find((u) => last10(u.phone) === phone);
    if (!user) return res.json({ success: true, applied: false, reason: "no_account" });

    const sub = user.subscription;
    const now = new Date();
    const active = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > now;
    const start = active ? new Date(sub.endDate) : now;
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const data = { plan: "REFERRAL_FREE", status: "active", startDate: active ? sub.startDate : now, endDate: end, amount: 0, expiryReminderSent: false };
    await prisma.subscription.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });

    res.json({ success: true, applied: true, userId: user.id, endDate: end.toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
