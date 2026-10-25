const crypto = require("crypto");
const Razorpay = require("razorpay");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plan catalogue — the single source of truth for pricing on both frontend and backend.
// Amounts are in paise (Razorpay's unit). Keep these in sync with the pricing page copy.
const PLANS = {
  MONTHLY: { label: "Monthly Full Access" }, // amount varies by class tier and months bought — see utils/pricing.js; always ends at month-end
};

// Free trial: 30 days of full access, no payment, once per student. Replaces the
// old paid ₹99 5-day trial (TRIAL_5D rows from before stay valid till they end).
const TRIAL_DAYS = 30;
const TRIAL_PLAN = "TRIAL_30D";
// A student can buy 1..MAX_MONTHS months of the MONTHLY plan in one payment.
const { MAX_MONTHS, tierFor, priceRupees, priceTable } = require("../utils/pricing");
const monthsOf = (v) => Math.min(MAX_MONTHS, Math.max(1, parseInt(v, 10) || 1));

// Eligible for the free trial = never had any plan activated (no paid, trial,
// referral or institute period). An abandoned checkout doesn't count.
const trialEligible = (sub) => !sub || (!sub.startDate && !sub.razorpayPaymentId);
const trialWindow = (from = new Date()) => {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return { startDate: new Date(from), endDate: end };
};

// MONTHLY plan price depends on the student's class tier and how many months
// they buy (6 and 12 months are discounted) — see utils/pricing.js. Paise here.
const getAmountPaise = (classLevel, months) => priceRupees(tierFor(classLevel), months) * 100;

// "Enrolled on Aug 20 → active till 23:59:59 on Aug 31" — i.e. always the last
// instant of the calendar month the subscription started in, never a rolling 30 days.
const endOfMonth = (from) => {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

// N months of the MONTHLY plan: the current calendar month plus N-1 more, each
// to its last day. When the student still has an active plan, the new months
// start the day after it ends, so renewing early never loses days.
const isActiveSub = (sub) => !!(sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date());
const monthlyEndDate = (months, sub, now = new Date()) => {
  const from = isActiveSub(sub) ? new Date(new Date(sub.endDate).getTime() + 1) : now;
  return endOfMonth(new Date(from.getFullYear(), from.getMonth() + (months - 1), 1));
};

// Called after a successful MONTHLY payment. Marks this person's own referral
// row (if they were referred by someone) as qualified, then immediately gives
// their referrer a free month. The free trial never counts toward this.
const checkReferralReward = async (userId) => {
  const myReferral = await prisma.referral.findUnique({ where: { referredId: userId } });
  if (!myReferral || myReferral.qualified) return; // not referred, or already counted

  await prisma.referral.update({ where: { id: myReferral.id }, data: { qualified: true } });

  const referrerSub = await prisma.subscription.findUnique({ where: { userId: myReferral.referrerId } });
  const alreadyActive = referrerSub?.status === "active" && referrerSub?.endDate && new Date(referrerSub.endDate) > new Date();
  // Stack onto their existing expiry if still active, otherwise start today —
  // either way they get one genuinely free calendar month added.
  const rewardStart = alreadyActive ? new Date(referrerSub.endDate) : new Date();
  const rewardEnd = new Date(rewardStart);
  rewardEnd.setDate(rewardEnd.getDate() + 30);

  await prisma.subscription.update({
    where: { userId: myReferral.referrerId },
    data: { plan: "REFERRAL_FREE", status: "active", startDate: alreadyActive ? referrerSub.startDate : rewardStart, endDate: rewardEnd, amount: 0, expiryReminderSent: false },
  });
  await prisma.referral.update({ where: { id: myReferral.id }, data: { rewardGranted: true } });
};

// GET /api/v1/subscription/plans — public plan list for the pricing page.
// Route uses optionalAuth, so req.user (and their class) is available whenever a
// valid session token is present, letting the MONTHLY price reflect their class tier.
exports.getPlans = async (req, res) => {
  const tier = tierFor(req.user?.profile?.class);
  res.json({
    success: true,
    tier: { key: tier.key, label: tier.label, free: !!tier.free },
    plans: tier.free ? [] : [
      {
        key: "MONTHLY", label: PLANS.MONTHLY.label, amountRupees: tier.monthly,
        duration: "Till end of current calendar month", maxMonths: MAX_MONTHS,
        prices: priceTable(tier), // [{ months, price, saving }] for 1..12
      },
    ],
    trial: { days: TRIAL_DAYS, eligible: !tier.free && (req.user ? trialEligible(req.user.subscription) : true) },
  });
};

// GET /api/v1/subscription/me — current student's subscription status
exports.getMySubscription = async (req, res) => {
  const sub = req.user.subscription;
  const isActive = !!(sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date());
  res.json({ success: true, subscription: sub, isActive });
};

// POST /api/v1/subscription/start-trial — activates the free 30-day trial (once per student).
exports.startTrial = async (req, res) => {
  try {
    // Class 6–8 is already free; keep the trial for when they move to Class 9.
    if (tierFor(req.user.profile?.class).free) return res.status(400).json({ success: false, message: "YNeet is already free for Class 6–8." });
    const sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    if (!trialEligible(sub)) return res.status(400).json({ success: false, message: "Your free trial has already been used." });
    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user.id },
      update: { plan: TRIAL_PLAN, status: "active", amount: 0, expiryReminderSent: false, ...trialWindow() },
      create: { userId: req.user.id, plan: TRIAL_PLAN, status: "active", amount: 0, ...trialWindow() },
    });
    res.json({ success: true, subscription });
  } catch (err) {
    console.error("startTrial error:", err);
    res.status(500).json({ success: false, message: "Could not start the free trial" });
  }
};

// POST /api/v1/subscription/checkout  { plan: "MONTHLY", months: 1..12 }
// Creates a Razorpay order for the chosen plan.
exports.createCheckout = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success: false, message: "Invalid plan" });

    // Price = the student's class tier for that many months (6 and 12 are discounted).
    // Class 6–8 is free, so there is nothing to buy.
    const months = monthsOf(req.body.months);
    if (tierFor(req.user.profile?.class).free) {
      return res.status(400).json({ success: false, message: "YNeet is free for Class 6–8 — no payment needed." });
    }
    const amount = getAmountPaise(req.user.profile?.class, months);
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `yneet_${req.user.id}_${Date.now()}`,
      notes: { userId: req.user.id, plan, months: String(months) },
    });

    // Only the pending order id is stored here — the student's current plan
    // (e.g. an active trial) stays untouched until the payment is verified.
    await prisma.subscription.update({
      where: { userId: req.user.id },
      data: { razorpayOrderId: order.id },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      months,
    });
  } catch (err) {
    console.error("createCheckout error:", err);
    res.status(500).json({ success: false, message: "Could not start checkout" });
  }
};

// POST /api/v1/subscription/verify
// { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Verifies the payment signature, then activates the subscription with the
// correct end date for the plan that was purchased.
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields" });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const existing = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    if (!existing || existing.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order mismatch" });
    }

    // Months and amount come from the Razorpay order itself (set at checkout).
    const order = await razorpay.orders.fetch(razorpay_order_id);
    if (String(order.notes?.userId) !== String(req.user.id)) {
      return res.status(400).json({ success: false, message: "Order mismatch" });
    }
    const months = monthsOf(order.notes?.months);
    const extending = isActiveSub(existing);
    const startDate = extending ? existing.startDate || new Date() : new Date();
    const endDate = monthlyEndDate(months, existing);

    const subscription = await prisma.subscription.update({
      where: { userId: req.user.id },
      data: {
        plan: "MONTHLY",
        amount: order.amount,
        status: "active",
        startDate,
        endDate,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        expiryReminderSent: false,
      },
    });

    // Referral reward check — only the Monthly plan qualifies, not the trial.
    {
      await checkReferralReward(req.user.id).catch((e) => console.warn("Referral reward check failed:", e.message));
    }

    // Best-effort: let Raise Academy know this student now has an active YNeet plan,
    // so their Raise Academy dashboard button can say "Continue" instead of "Start".
    try {
      const base = process.env.RAISE_ACADEMY_API_URL;
      if (base && process.env.INTERNAL_SERVICE_KEY) {
        await axios.post(
          `${base}/auth/internal/yneet-subscription`,
          { userId: req.user.id, subscribed: true },
          { headers: { "X-Internal-Key": process.env.INTERNAL_SERVICE_KEY }, timeout: 5000 }
        );
      }
    } catch (e) {
      console.warn("Could not sync subscription flag back to Raise Academy:", e.message);
    }

    res.json({ success: true, subscription });
  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
};

// exported for tests
exports._internal = { monthlyEndDate, trialEligible, trialWindow, monthsOf, endOfMonth };
