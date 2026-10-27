// New students get YNeet straight away (no OTP at sign-up). They confirm their
// WhatsApp number (OTP) or email (link) inside YNeet; a free trial keeps working
// for GRACE_DAYS without that, then pauses until they verify. Paid, referral and
// institute plans are never paused by this.
const GRACE_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

const deadlineFor = (user) => new Date(new Date(user.createdAt || Date.now()).getTime() + GRACE_DAYS * DAY);

function verificationState(user) {
  if (!user || user.isVerified !== false) return { required: false, blocked: false, deadline: null };
  // Class 6–8 is free forever, so there's no trial to protect.
  if (["6th", "7th", "8th"].includes(user.profile?.class)) return { required: false, blocked: false, deadline: null };
  // Only the free trial depends on it; paid / referral / institute plans don't nag.
  const onTrial = ["TRIAL_30D", "NONE"].includes(user.subscription?.plan || "NONE");
  if (!onTrial) return { required: false, blocked: false, deadline: null };
  const deadline = deadlineFor(user);
  return { required: true, blocked: Date.now() > deadline.getTime(), deadline };
}

module.exports = { GRACE_DAYS, verificationState };
