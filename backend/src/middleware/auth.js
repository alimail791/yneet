const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    // Same JWT_SECRET as Raise Academy — this verifies the token is a legitimate
    // Raise Academy session token before we trust the id inside it.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { subscription: true, profile: true, xp: true, streak: true },
    });

    // First time this student hits YNeet with a valid token but no local row yet
    // (e.g. they opened a deep link before ever going through /bridge) — provision now.
    if (!user) {
      const { provisionFromRaiseAcademy } = require("../controllers/authController");
      user = await provisionFromRaiseAcademy(token);
    }

    // Single-active-session check, mirroring Raise Academy's: if this account has
    // since logged in elsewhere (and that device has visited YNeet, syncing the new
    // sid here), this older token's sid will no longer match — reject it. A null
    // sessionId means this row predates the feature or hasn't synced yet; let it
    // through rather than falsely locking someone out.
    if (user.sessionId && decoded.sid && decoded.sid !== user.sessionId) {
      return res.status(401).json({ success: false, message: "Logged out — this account signed in on another device." });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requirePlan = (plans) => (req, res, next) => {
  const plan = req.user?.subscription?.plan || "NONE";
  if (!plans.includes(plan))
    return res.status(403).json({ success: false, message: `This feature requires ${plans.join(" or ")} plan`, upgrade: true });
  next();
};

// YNeet is paid-only: every content route (mock/quiz/practice/etc.) sits behind this.
const requireActiveSubscription = (req, res, next) => {
  const sub = req.user?.subscription;
  const isActive = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date();
  if (!isActive) {
    return res.status(402).json({
      success: false,
      message: "An active YNeet subscription is required to access this feature.",
      upgrade: true,
    });
  }
  next();
};

// Gates the /admin content-management panel — role is synced from Raise Academy
// on every login, so promoting/demoting an admin happens over there, not here.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

module.exports = { protect, requirePlan, requireActiveSubscription, requireAdmin };
