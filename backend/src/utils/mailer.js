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
const sendParentDigest = async (parentEmail, student, stats) => {
  await send({
    to: parentEmail,
    subject: `${student.name}'s NEET prep update — YNeet`,
    html: `<div style="${baseStyle}">${header}
      <h2 style="color:#0f172a">Weekly update for ${student.name}</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#64748b;">Current score</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;">${stats.currentScore}/720</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Target score</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;">${stats.targetScore}/720</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Study streak</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;">${stats.streak} days</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Mock tests taken</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#1e293b;">${stats.mockCount}</td></tr>
      </table>
      ${stats.weakSubjects?.length ? `<p style="color:#475569;font-size:14px;">Areas needing more focus: <strong>${stats.weakSubjects.join(", ")}</strong></p>` : ""}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">You're receiving this because ${student.name} added your email in their YNeet profile for progress updates.</p>
    </div>`,
  });
};

module.exports = { sendExpiryReminder, sendParentDigest, sendInactivityReminder };
