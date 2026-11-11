const { PrismaClient } = require("@prisma/client");
const { labelSource } = require("../utils/pyqSource");
const prisma = new PrismaClient();

exports.getMistakes = async (req, res) => {
  try {
    const { source, subject, page=1, limit=15 } = req.query;
    const where = { userId: req.user.id };
    if (source) where.source = source;
    if (subject) where.question = { subject };
    const [mistakes, total] = await Promise.all([
      prisma.mistake.findMany({ where, skip:(parseInt(page)-1)*parseInt(limit), take:parseInt(limit), orderBy:[{count:"desc"},{lastSeen:"desc"}], include:{ question:{ select:{ id:true,subject:true,chapter:true,topic:true,questionText:true,optionA:true,optionB:true,optionC:true,optionD:true,correctOpt:true,explanation:true,isPYQ:true,pyqYear:true } } } }),
      prisma.mistake.count({ where }),
    ]);
    res.json({ success: true, mistakes: mistakes.map((m) => ({ ...m, question: labelSource(m.question) })), total, pages: Math.ceil(total/parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
