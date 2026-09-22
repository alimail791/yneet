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

const send = async ({ to, subject, html }) => {
  const { error } = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "YNeet <noreply@yneet.in>",
    to, subject, html,
  });
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

module.exports = { sendExpiryReminder, sendParentDigest };
