// Account-level actions that must happen in BOTH systems: the login lives in
// Raise Academy (Mongo), everything else in YNeet. Deleting only the YNeet row
// would be undone at the next login (the SSO bridge re-creates it), and a class
// changed only here would be overwritten by the bridge's class sync.
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const raise = (path, body) => {
  const base = process.env.RAISE_ACADEMY_API_URL, key = process.env.INTERNAL_SERVICE_KEY;
  if (!base || !key) throw new Error("RAISE_ACADEMY_API_URL / INTERNAL_SERVICE_KEY not configured");
  return axios.post(`${base.replace(/\/$/, "")}/auth/internal/${path}`, body, { headers: { "x-internal-key": key }, timeout: 10000 });
};

// YNeet class names ↔ Raise Academy's currentClass
const CLASS_LADDER = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const toRaise = (c) => (c === "Dropper" ? "Dropper" : String(c).replace(/th$/, ""));
const nextClass = (c) => CLASS_LADDER[CLASS_LADDER.indexOf(c) + 1] || null;
const JUNIOR = ["6th", "7th", "8th"];

/** Permanently delete a student everywhere. Throws if the login couldn't be deleted. */
async function deleteAccount(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role === "admin") throw new Error("Admin accounts can't be deleted");
  try {
    await raise("delete-student", { id: userId });
  } catch (e) {
    throw new Error(e.response?.data?.message || `Couldn't delete the login: ${e.message}`);
  }
  await prisma.user.deleteMany({ where: { id: userId } }); // cascades to tests, practice, mistakes, …
  return true;
}

/**
 * Change a student's class in both systems. force = admin (any class, any time);
 * otherwise only one step up, and Raise Academy enforces the waiting period.
 */
async function changeClass(userId, newClass, { force = false } = {}) {
  if (!CLASS_LADDER.includes(newClass)) throw new Error("Unknown class");
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true, subscription: true } });
  if (!user?.profile) throw new Error("Student not found");
  const from = user.profile.class;
  try {
    await raise("set-class", { id: userId, currentClass: toRaise(newClass), force });
  } catch (e) {
    const err = new Error(e.response?.data?.message || `Couldn't change the class: ${e.message}`);
    err.status = e.response?.status === 400 ? 400 : 502;
    throw err;
  }
  await prisma.profile.update({ where: { userId }, data: { class: newClass } });

  // Leaving the free Junior classes (6–8) for Class 9+: a fresh 30-day trial of the
  // paid content, once — the ladder only goes up, so this can't repeat.
  let trialStarted = false;
  const sub = user.subscription;
  const paidActive = sub && sub.status === "active" && sub.endDate && new Date(sub.endDate) > new Date() && !["TRIAL_30D", "NONE"].includes(sub.plan);
  if (JUNIOR.includes(from) && !JUNIOR.includes(newClass) && !paidActive) {
    const s = new Date(), e = new Date(s); e.setDate(e.getDate() + 30);
    await prisma.subscription.upsert({
      where: { userId },
      update: { plan: "TRIAL_30D", status: "active", startDate: s, endDate: e, amount: 0, expiryReminderSent: false },
      create: { userId, plan: "TRIAL_30D", status: "active", startDate: s, endDate: e, amount: 0 },
    });
    trialStarted = true;
  }
  return { from, to: newClass, trialStarted };
}

/** Read, or set when parentPhone is given ("" removes), the parent's WhatsApp number (kept in Raise Academy). */
async function parentPhone(userId, value) {
  try {
    const { data } = await raise("parent", value === undefined ? { id: userId } : { id: userId, parentPhone: value });
    return data.parentPhone || null;
  } catch (e) {
    const err = new Error(e.response?.data?.message || `Couldn't save the number: ${e.message}`);
    err.status = e.response?.status === 400 ? 400 : 502;
    throw err;
  }
}

module.exports = { deleteAccount, changeClass, nextClass, parentPhone, CLASS_LADDER, JUNIOR };
