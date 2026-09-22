const router = require("express").Router();
const { protect, requireActiveSubscription } = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const { generateStudyPlan } = require("../controllers/aiController");
const prisma = new PrismaClient();
router.use(protect);
router.use(requireActiveSubscription);
router.get("/", async (req, res) => {
  try {
    const plan = await prisma.studyPlan.findUnique({ where: { userId: req.user.id } });
    res.json({ success: true, plan: plan?.plan || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post("/save", async (req, res) => {
  try {
    const { plan } = req.body;
    const saved = await prisma.studyPlan.upsert({ where: { userId: req.user.id }, update: { plan }, create: { userId: req.user.id, plan } });
    res.json({ success: true, plan: saved.plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post("/generate", generateStudyPlan);
module.exports = router;
