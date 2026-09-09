const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getDashboard = async (req, res) => {
  try {
    const uid = req.user.id;
    const [attempts, mistakeCounts, practiceTotal, practiceCorrect, streak, xp, profile, recentQuiz] = await Promise.all([
      prisma.attempt.findMany({ where: { userId: uid, status: "submitted" }, orderBy: { submittedAt: "asc" }, select: { score:true,accuracy:true,physicsScore:true,chemScore:true,bioScore:true,submittedAt:true,mockTest:{ select:{ title:true } } } }),
      prisma.mistake.groupBy({ by: ["source"], where: { userId: uid }, _count: { id: true } }),
      prisma.practiceStat.count({ where: { userId: uid } }),
      prisma.practiceStat.count({ where: { userId: uid, correct: true } }),
      prisma.streak.findUnique({ where: { userId: uid } }),
      prisma.xP.findUnique({ where: { userId: uid } }),
      prisma.profile.findUnique({ where: { userId: uid } }),
      prisma.quizResult.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 7 }),
    ]);

    const scores = attempts.map(a => a.score);
    const best = scores.length ? Math.max(...scores) : 0;
    const latest = attempts.at(-1)?.score || 0;
    const avgAcc = attempts.length ? Math.round(attempts.reduce((s,a) => s+a.accuracy, 0)/attempts.length) : 0;

    let predicted = latest;
    if (scores.length >= 3) {
      const recent = scores.slice(-5);
      const n = recent.length;
      const meanX = (n-1)/2, meanY = recent.reduce((a,b)=>a+b,0)/n;
      const num = recent.reduce((s,y,x)=>s+(x-meanX)*(y-meanY),0);
      const den = recent.reduce((s,_,x)=>s+(x-meanX)**2,0);
      const slope = den ? num/den : 0;
      predicted = Math.min(720, Math.max(0, Math.round(latest + slope*5)));
    }

    const rankEst = s => s>=680?500:s>=650?2000:s>=600?8000:s>=550?20000:s>=500?45000:s>=450?90000:150000;
    const mistakeBySource = {};
    mistakeCounts.forEach(m => { mistakeBySource[m.source] = m._count.id; });

    const totalPhyScore = attempts.reduce((s,a)=>s+Math.max(0,a.physicsScore),0);
    const totalChemScore = attempts.reduce((s,a)=>s+Math.max(0,a.chemScore),0);
    const totalBioScore = attempts.reduce((s,a)=>s+Math.max(0,a.bioScore),0);
    const maxPhy = attempts.length * 180;
    const maxChem = attempts.length * 180;
    const maxBio = attempts.length * 360;

    res.json({
      success: true,
      stats: {
        totalAttempts: attempts.length, bestScore: best, latestScore: latest, predictedScore: predicted, avgAccuracy: avgAcc,
        mistakes: { mock: mistakeBySource.mock||0, quiz: mistakeBySource.quiz||0, practice: mistakeBySource.practice||0, total: (mistakeBySource.mock||0)+(mistakeBySource.quiz||0)+(mistakeBySource.practice||0) },
        practiceCount: practiceTotal,
        practiceAccuracy: practiceTotal ? Math.round(practiceCorrect/practiceTotal*100) : 0,
        streak: { current: streak?.current||0, longest: streak?.longest||0 },
        xp: { total: xp?.total||0, level: xp?.level||1 },
        subjects: {
          physics: maxPhy ? Math.round(totalPhyScore/maxPhy*100) : 0,
          chemistry: maxChem ? Math.round(totalChemScore/maxChem*100) : 0,
          biology: maxBio ? Math.round(totalBioScore/maxBio*100) : 0,
        },
        rank: { expected: rankEst(latest), best: rankEst(best), predicted: rankEst(predicted) },
        targetScore: profile?.targetScore||650,
        currentScore: profile?.currentScore||0,
        successProbability: Math.min(99, Math.round((predicted/(profile?.targetScore||650))*100)),
      },
      scoreHistory: attempts.map((a,i) => ({ attempt:i+1, score:a.score, label:a.mockTest?.title||`Mock ${i+1}`, date:a.submittedAt })),
      recentQuizScores: [...recentQuiz].reverse(),
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
