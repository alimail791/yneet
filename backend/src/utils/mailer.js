const { Resend } = require("resend");

// Switched from Gmail SMTP to Resend's HTTPS API — Railway blocks/throttles
// outbound SMTP on ports 587/465, so emails would silently time out even
// with correct credentials (see the same fix applied to Raise Academy's
// backend). Requires RESEND_API_KEY and a verified sending domain.
// Lazily created (not at module load) because ES/CJS import order can run
// before dotenv finishes loading — see raise-academy's sendEmail.js for the
// same reasoning.
let resend;
const getResend = () => {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
};

const baseStyle = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;`;
const btnStyle = `display:inline-block;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:16px 0;`;
const header = `<h1 style="color:#1e3a8a;font-size:28px;margin-bottom:4px">YNeet 🎯</h1><p style="color:#7c3aed;font-size:13px;margin-bottom:24px">Your Personal NEET Mentor</p>`;

// Plain-text alternative + optional reply-to: HTML-only mail is a spam signal,
// and a real reply-to mailbox helps sender reputation. Links are kept in the
// text version as "label: url" so they still work without HTML.
const htmlToText = (html) => html
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
  .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .trim();

const send = async ({ to, subject, html }) => {
  const payload = {
    from: process.env.RESEND_FROM_EMAIL || "YNeet <noreply@yneet.in>",
    to, subject, html,
    text: htmlToText(html),
  };
  if (process.env.RESEND_REPLY_TO) payload.replyTo = process.env.RESEND_REPLY_TO;
  const { error } = await getResend().emails.send(payload);
  if (error) throw new Error(error.message || "Failed to send email via Resend");
};

// A student's Monthly/Trial plan expires in ~3 days — nudge them to renew
// before it lapses, rather than letting it go quiet.
const sendExpiryReminder = async (user, daysLeft) => {
  const url = `${process.env.FRONTEND_URL}/pricing`;
  await send({
    to: user.email,
    subject: `Your YNeet plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} ⏳`,
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">Hi ${user.name}, your plan is ending soon</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Your YNeet subscription expires in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>. Renew now to keep uninterrupted access to mock tests, daily quizzes, and everything else.</p>
      <a href="${url}" style="${btnStyle}background:#2563eb;color:white;">Renew My Plan →</a>
    </div>`,
  });
};

// Sent once to a student who hasn't opened YNeet for ~5 days.
const sendInactivityReminder = async (user) => {
  const url = process.env.FRONTEND_URL || "https://app.yneet.in";
  await send({
    to: user.email,
    subject: `We miss you, ${user.name.split(" ")[0]} — your NEET prep is waiting 🎯`,
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">Hi ${user.name}, it's been a few days</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">You haven't opened YNeet in about 5 days. A little practice every day adds up — a quick 20-question daily practice test or a mistake-notebook revision takes just a few minutes and keeps your streak and rank moving.</p>
      <a href="${url}" style="${btnStyle}background:#2563eb;color:white;">Continue My Prep →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">You're receiving this because you have a YNeet account. Log in any time to pick up where you left off.</p>
    </div>`,
  });
};

// Weekly-ish progress summary sent to a parent's email, if the student added
// one in their Profile. Purely informational — no login/action needed from
// the parent.
// Weekly parent report — see utils/parentReport.js for how the numbers are built.
const sendParentDigest = async (parentEmail, stats) => {
  const { reportHtml } = require("./parentReport");
  await send({
    to: parentEmail,
    subject: `${stats.name}'s weekly NEET progress — YNeet`,
    html: `<div style="${baseStyle}">${header}
      ${reportHtml(stats)}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">You're receiving this because ${stats.name} added your email in their YNeet profile for weekly progress updates. To stop these emails, ask them to remove it under Profile → Parent Updates, or reply to this email.</p>
    </div>`,
  });
};

// ───── Creators ─────
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 6-digit code for checking a creator's email, or for resetting their password.
const sendCreatorCode = async (creator, code, purpose) => {
  const verify = purpose === "verify";
  await send({
    to: creator.email,
    subject: verify ? `Your YNeet creator code: ${code}` : `Reset your YNeet creator password: ${code}`,
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">Hi ${escHtml(creator.name)},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">${verify ? "Enter this code to confirm your email for your YNeet creator account:" : "Enter this code to set a new password for your YNeet creator account:"}</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1e3a8a;margin:18px 0">${code}</p>
      <p style="color:#94a3b8;font-size:12px">The code works for 15 minutes. If you didn't ask for it, you can ignore this email.</p>
    </div>`,
  });
};

// Tells the YNeet admin that a new creator applied.
const ADMIN_ALERT_EMAIL = () => process.env.ADMIN_ALERT_EMAIL || "alimail791@gmail.com";
const sendCreatorSignupAlert = async (creator) => {
  const url = `${process.env.FRONTEND_URL || "https://app.yneet.in"}/admin/creators`;
  const row = (k, v) => (v ? `<tr><td style="color:#64748b;padding:4px 12px 4px 0">${k}</td><td style="color:#0f172a">${escHtml(v)}</td></tr>` : "");
  await send({
    to: ADMIN_ALERT_EMAIL(),
    subject: `New YNeet creator: ${creator.name}`,
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">A new creator applied</h2>
      <table style="font-size:14px;line-height:1.5">
        ${row("Name", creator.name)}${row("Email", creator.email)}${row("WhatsApp", creator.phone)}
        ${row("Subjects", (creator.subjects || []).join(", "))}${row("Languages", (creator.languages || []).join(", "))}
        ${row("YouTube", creator.youtubeUrl)}${row("Instagram", creator.instagramUrl)}${row("About", creator.bio)}
      </table>
      <p style="color:#475569;font-size:14px">Their email is not verified yet; they have been sent a code.</p>
      <a href="${url}" style="${btnStyle}background:#2563eb;color:white;">Review in Admin → Creators</a>
    </div>`,
  });
};

// Email confirmation link for a new student (no OTP at sign-up any more).
const sendVerifyEmail = async (user, link) => {
  await send({
    to: user.email,
    subject: "Confirm your email to keep your free YNeet trial",
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">Hi ${user.name}, one tap to confirm</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Confirm your email so your free 30-day YNeet trial keeps running.</p>
      <a href="${link}" style="${btnStyle}background:#2563eb;color:white;">Confirm my email →</a>
      <p style="color:#94a3b8;font-size:12px">This link works for 7 days. If you didn't sign up for YNeet, ignore this email.</p>
    </div>`,
  });
};

module.exports = { sendVerifyEmail, sendExpiryReminder, sendParentDigest, sendInactivityReminder, sendCreatorCode, sendCreatorSignupAlert };
