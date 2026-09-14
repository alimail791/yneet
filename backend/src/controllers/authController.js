const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Maps Raise Academy's class fields to YNeet's classLevel vocabulary.
// School Tuition students use `class` (6-12), NEET Coaching students use
// `currentClass` (6-12 or "Dropper").
const toClassLevel = (raiseUser) => {
  const raw = raiseUser.currentClass || raiseUser.class;
  if (!raw) return "12th";
  if (raw === "Dropper" || raw === "Repeater") return "Dropper";
  return `${raw}th`;
};

// Short, shareable, human-typeable code — e.g. "X7K2QPLM". Collisions are
// astronomically unlikely at this scale, but we retry once just in case.
const generateReferralCode = async () => {
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique referral code");
};

// Fetches the student's profile from Raise Academy using the same bearer token,
// then creates/updates the matching local User+Profile+Subscription+Streak+XP rows.
// The user's Raise Academy Mongo _id becomes the local User.id — this is what makes
// login "shared": there is no separate YNeet password anywhere.
const provisionFromRaiseAcademy = async (token) => {
  const base = process.env.RAISE_ACADEMY_API_URL;
  if (!base) throw new Error("RAISE_ACADEMY_API_URL is not configured");

  const { data } = await axios.get(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
  });
  const raiseUser = data.user;
  if (!raiseUser?.id) throw new Error("Raise Academy did not return a valid user");

  const classLevel = toClassLevel(raiseUser);
  // The token's `sid` claim is Raise Academy's single-active-session marker — jwt.decode
  // (no secret needed) is fine here since the /auth/me call above already proved this
  // token's signature is valid.
  const sid = jwt.decode(token)?.sid || null;

  const existingUser = await prisma.user.findUnique({ where: { id: raiseUser.id } });
  const isNewUser = !existingUser;
  const referralCode = existingUser?.referralCode || await generateReferralCode();

  let user;
  try {
    user = await prisma.user.upsert({
      where: { id: raiseUser.id },
      update: {
        email: raiseUser.email,
        name: raiseUser.fullName,
        phone: raiseUser.phone || null,
        gender: raiseUser.gender || null,
        place: raiseUser.place || null,
        role: raiseUser.role || "student",
        sessionId: sid,
        referralCode,
      },
      create: {
        id: raiseUser.id,
        email: raiseUser.email,
        name: raiseUser.fullName,
        phone: raiseUser.phone || null,
        gender: raiseUser.gender || null,
        place: raiseUser.place || null,
        isVerified: true,
        role: raiseUser.role || "student",
        sessionId: sid,
        referralCode,
        profile: {
          create: {
            class: classLevel,
            examYear: raiseUser.neetExamYear || new Date().getFullYear() + 1,
            weakSubjects: [],
            strongSubjects: [],
          },
        },
        subscription: { create: { plan: "NONE", status: "inactive" } },
        streak: { create: {} },
        xp: { create: {} },
      },
      include: { profile: true, subscription: true, streak: true, xp: true },
    });
  } catch (err) {
    // P2002 = unique constraint violation. The nested profile/subscription/streak/xp
    // creates force Prisma into a check-then-write upsert rather than a single atomic
    // statement, so two near-simultaneous bridge calls for a brand-new user (two tabs,
    // a slow request the frontend retried, etc.) can both see "doesn't exist yet" and
    // both try to create it — only one write wins. Rather than surface that race as a
    // login failure, just fetch what the other request already created.
    if (err.code === "P2002") {
      user = await prisma.user.findUnique({
        where: { id: raiseUser.id },
        include: { profile: true, subscription: true, streak: true, xp: true },
      });
      if (!user) throw err; // genuinely something else — don't swallow it
    } else {
      throw err;
    }
  }

  // First time this person has ever hit YNeet — if Raise Academy recorded that
  // they registered via someone's referral link, create the Referral row now.
  // Only ever happens once per user (existingUser check above), so this can't
  // be gamed by re-logging-in with a different code later.
  if (isNewUser && raiseUser.referredByCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: raiseUser.referredByCode } });
    if (referrer && referrer.id !== user.id) {
      await prisma.referral.create({ data: { referrerId: referrer.id, referredId: user.id } }).catch(() => {});
    }
  }

  // Keep class level in sync on every login in case the student's class changed
  // on the Raise Academy side (e.g. promoted a grade, switched to Dropper).
  if (user.profile && user.profile.class !== classLevel) {
    await prisma.profile.update({ where: { userId: user.id }, data: { class: classLevel } });
    user.profile.class = classLevel;
  }

  return user;
};

// POST /api/v1/auth/bridge  { token }
// Called by the YNeet frontend right after it's handed a Raise Academy token via the
// SSO redirect. provisionFromRaiseAcademy() will fail if the token isn't a valid
// Raise Academy token (the /auth/me call there enforces that), so by the time we get
// a user back here, the token has already been validated upstream. We hand back the
// SAME token for the frontend to keep using — there's only ever one token in play.
exports.bridge = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "token is required" });

    const user = await provisionFromRaiseAcademy(token);
    res.json({ success: true, token, user });
  } catch (err) {
    console.error("SSO bridge error:", err.response?.data || err.message);
    res.status(401).json({ success: false, message: "Could not verify Raise Academy session" });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports.provisionFromRaiseAcademy = provisionFromRaiseAcademy;
