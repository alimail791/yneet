const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const XP_REWARDS = { daily_login:5, quiz_complete:10, quiz_perfect:25, mock_complete:50, practice_10:15, streak_7:100, streak_14:200, streak_30:500 };
const LEVELS = [0,100,300,600,1000,1500,2200,3000,4000,5500,7500];
const getLevel = (total) => { for (let i = LEVELS.length-1; i >= 0; i--) if (total >= LEVELS[i]) return i+1; return 1; };
const awardXP = async (userId, action) => {
  const pts = XP_REWARDS[action] || 0;
  if (!pts) return null;
  const xp = await prisma.xP.upsert({
    where: { userId },
    update: { total: { increment: pts } },
    create: { userId, total: pts, level: 1 },
  });
  const newTotal = (xp.total || 0) + pts;
  const newLevel = getLevel(newTotal);
  if (newLevel !== xp.level) await prisma.xP.update({ where: { userId }, data: { level: newLevel } });
  return { points: pts, newTotal, level: newLevel };
};
module.exports = { awardXP, getLevel, LEVELS };
