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
  TRIAL_5D: { label: "5-Day Full Access", amount: 9900, days: 5 }, // ₹99
  MONTHLY: { label: "Monthly Full Access", amount: 29900 }, // ₹299, always ends at month-end
};

// "Enrolled on Aug 20 → active till 23:59:59 on Aug 31" — i.e. always the last
// instant of the calendar month the subscription started in, never a rolling 30 days.
const endOfMonth = (from) => {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

const computeEndDate = (planKey, startDate) => {
  if (planKey === "TRIAL_5D") {
    const end = new Date(startDate);
    end.setDate(end.getDate() + PLANS.TRIAL_5D.days);
    return end;
  }
  return endOfMonth(startDate); // MONTHLY
};

// Called after a successful MONTHLY payment. Marks this person's own referral
// row (if they were referred by someone) as qualified, then checks whether
// their referrer has now hit 2 qualified-but-unrewarded referrals — if so,
// grants a free month. Trial (₹99) purchases never count toward this.
const checkReferralReward = async (userId) => {
  const myReferral = await prisma.referral.findUnique({ where: { referredId: userId } });
  if (!myReferral || myReferral.qualified) return; // not referred, or already counted

  await prisma.referral.update({ where: { id: myReferral.id }, data: { qualified: true } });

  const unrewarded = await prisma.referral.findMany({
    where: { referrerId: myReferral.referrerId, qualified: true, rewardGranted: false },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (unrewarded.length < 2) return; // needs exactly 2 qualified referrals per reward

  const referrerSub = await prisma.subscription.findUnique({ where: { userId: myReferral.referrerId } });
  const alreadyActive = referrerSub?.status === "active" && referrerSub?.endDate && new Date(referrerSub.endDate) > new Date();
  // Stack onto their existing expiry if still active, otherwise start today —
  // either way they get one genuinely free calendar month added.
  const rewardStart = alreadyActive ? new Date(referrerSub.endDate) : new Date();
  const rewardEnd = new Date(rewardStart);
  rewardEnd.setDate(rewardEnd.getDate() + 30);

  await prisma.subscription.update({
    where: { userId: myReferral.referrerId },
    data: { plan: "REFERRAL_FREE", status: "active", startDate: alreadyActive ? referrerSub.startDate : rewardStart, endDate: rewardEnd, amount: 0 },
  });
  await prisma.referral.updateMany({
    where: { id: { in: unrewarded.map(r => r.id) } },
    data: { rewardGranted: true },
  });
};

// GET /api/v1/subscription/plans — public plan list for the pricing page
exports.getPlans = async (_req, res) => {
  res.json({
    success: true,
    plans: [
      { key: "TRIAL_5D", label: PLANS.TRIAL_5D.label, amountRupees: PLANS.TRIAL_5D.amount / 100, duration: "5 days" },
      { key: "MONTHLY", label: PLANS.MONTHLY.label, amountRupees: PLANS.MONTHLY.amount / 100, duration: "Till end of current calendar month" },
    ],
  });
};

// GET /api/v1/subscription/me — current student's subscription status
exports.getMySubscription = async (req, res) => {
  const sub = req.user.subscription;
  const isActive = !!(sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date());
  res.json({ success: true, subscription: sub, isActive });
};

// POST /api/v1/subscription/checkout  { plan: "TRIAL_5D" | "MONTHLY" }
// Creates a Razorpay order for the chosen plan.
exports.createCheckout = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success: false, message: "Invalid plan" });

    const { amount } = PLANS[plan];
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `yneet_${req.user.id}_${Date.now()}`,
      notes: { userId: req.user.id, plan },
    });

    await prisma.subscription.update({
      where: { userId: req.user.id },
      data: { razorpayOrderId: order.id, plan, amount, status: "inactive" },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
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

    const startDate = new Date();
    const endDate = computeEndDate(existing.plan, startDate);

    const subscription = await prisma.subscription.update({
      where: { userId: req.user.id },
      data: {
        status: "active",
        startDate,
        endDate,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    // Referral reward check — only the Monthly plan qualifies, not the trial.
    if (existing.plan === "MONTHLY") {
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
