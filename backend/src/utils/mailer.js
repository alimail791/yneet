const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const baseStyle = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8fafc;`;
const btnStyle = `display:inline-block;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:16px 0;`;

const sendVerificationEmail = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM, to: email,
    subject: "Verify your YNeet account ✅",
    html: `<div style="${baseStyle}">
      <h1 style="color:#1e3a8a;font-size:28px;margin-bottom:4px">YNeet 🎯</h1>
      <p style="color:#7c3aed;font-size:13px;margin-bottom:24px">Your Personal NEET Mentor</p>
      <h2 style="color:#0f172a">Welcome, ${name}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Thank you for joining YNeet. Click the button below to verify your email and start your NEET journey.</p>
      <a href="${url}" style="${btnStyle}background:#2563eb;color:white;">Verify Email →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't create this account, you can safely ignore this email.</p>
    </div>`,
  });
};

const sendPasswordReset = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM, to: email,
    subject: "Reset your YNeet password 🔐",
    html: `<div style="${baseStyle}">
      <h1 style="color:#1e3a8a;font-size:28px;margin-bottom:4px">YNeet 🎯</h1>
      <p style="color:#7c3aed;font-size:13px;margin-bottom:24px">Your Personal NEET Mentor</p>
      <h2 style="color:#0f172a">Password Reset Request</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Hi ${name}, we received a request to reset your password. Click below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${url}" style="${btnStyle}background:#dc2626;color:white;">Reset Password →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't request a password reset, ignore this email. Your password won't change.</p>
    </div>`,
  });
};

module.exports = { sendVerificationEmail, sendPasswordReset };
