const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/v1/leaderboard — top 20 students by total XP, plus the current
// user's own rank if they're outside the top 20 (so nobody feels invisible).
// Admins are excluded. First names + last-initial only, to keep it light on
// privacy while still feeling personal and competitive.
const shorten = (name) => {
  const parts = (name || "Student").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

exports.getLeaderboard = async (req, res) => {
  try {
    const top = await prisma.user.findMany({
      where: { role: { not: "admin" } },
      orderBy: { xp: { total: "desc" } },
      take: 20,
      select: { id: true, name: true, xp: { select: { total: true, level: true } }, streak: { select: { current: true } } },
    });

    const board = top.map((u, i) => ({
      rank: i + 1,
      name: shorten(u.name),
      xp: u.xp?.total || 0,
      level: u.xp?.level || 1,
      streak: u.streak?.current || 0,
      isMe: u.id === req.user.id,
    }));

    let me = board.find((b) => b.isMe);
    if (!me) {
      // Not in the top 20 — work out their actual rank with a count query.
      const myXp = req.user.xp?.total || 0;
      const higherCount = await prisma.user.count({
        where: { role: { not: "admin" }, xp: { total: { gt: myXp } } },
      });
      me = {
        rank: higherCount + 1,
        name: shorten(req.user.name),
        xp: myXp,
        level: req.user.xp?.level || 1,
        streak: req.user.streak?.current || 0,
        isMe: true,
        outsideTop20: true,
      };
    }

    res.json({ success: true, board, me });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
