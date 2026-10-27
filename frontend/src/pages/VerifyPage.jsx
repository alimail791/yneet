import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Confirm WhatsApp number (OTP) or email (link). New students get YNeet
// straight after sign-up and have 3 days to do this before the free trial pauses.
export default function VerifyPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState((user?.phone || "").replace(/\D/g, "").slice(-10));
  const [sent, setSent] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [emailSent, setEmailSent] = useState("");
  const v = user?.verification || {};

  useEffect(() => { if (user && !v.required) navigate("/", { replace: true }); }, [user]); // eslint-disable-line

  const call = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ err: true, text: e?.response?.data?.message || "Something went wrong. Please try again." }); }
    finally { setBusy(false); }
  };
  const sendCode = () => call(async () => {
    const { data } = await api.post("/user/verify/whatsapp/send", { phone });
    if (data.alreadyVerified) return done();
    setSent(data.sentTo); setMsg({ text: `Code sent on WhatsApp to ${data.sentTo}.` });
  });
  const confirm = () => call(async () => {
    await api.post("/user/verify/whatsapp/confirm", { code });
    await done();
  });
  const sendEmail = () => call(async () => {
    const { data } = await api.post("/user/verify/email/send");
    if (data.alreadyVerified) return done();
    setEmailSent(data.sentTo);
  });
  const done = async () => { await refreshUser(); navigate("/", { replace: true }); };

  const daysLeft = v.deadline ? Math.max(0, Math.ceil((new Date(v.deadline) - Date.now()) / 864e5)) : 0;
  const box = { maxWidth: 440, margin: "0 auto", background: "var(--white, #fff)", borderRadius: 18, padding: 28, boxShadow: "0 10px 30px rgba(0,0,0,.08)" };
  const input = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border, #cbd5e1)", fontSize: 16, marginTop: 6, background: "transparent", color: "var(--text)" };
  const btn = { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 12, justifyContent: "center" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "48px 20px" }}>
      <div style={box}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: .4 }}>One quick step</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: "6px 0 8px" }}>
          {v.blocked ? "Verify to continue your free trial" : "Confirm your WhatsApp number"}
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.6 }}>
          {v.blocked ? "Your free trial is paused until you confirm your WhatsApp number or email. It takes 10 seconds."
            : `Keep your free 30-day trial running — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left to confirm.`}
        </p>

        <label style={{ display: "block", marginTop: 20, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>WhatsApp number</label>
        <input style={input} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" disabled={!!sent} />
        {!sent ? (
          <button className="btn" style={{ ...btn, background: "#25D366", color: "#fff" }} disabled={busy} onClick={sendCode}>
            {busy ? "Sending…" : "Send code on WhatsApp"}
          </button>
        ) : (
          <>
            <input style={{ ...input, textAlign: "center", letterSpacing: "0.4em", fontSize: 20 }} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" />
            <button className="btn" style={{ ...btn, background: "var(--blue-mid)", color: "#fff" }} disabled={busy || code.length < 6} onClick={confirm}>
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button className="btn" style={{ ...btn, background: "transparent", color: "var(--blue-mid)", marginTop: 6 }} disabled={busy} onClick={() => { setSent(""); setCode(""); }}>
              Change number / send again
            </button>
          </>
        )}

        {msg && <p style={{ marginTop: 12, fontSize: 13, color: msg.err ? "var(--red, #dc2626)" : "var(--text2)" }}>{msg.text}</p>}

        <div style={{ borderTop: "1px solid var(--border, #e2e8f0)", marginTop: 22, paddingTop: 16 }}>
          {emailSent ? (
            <p style={{ fontSize: 14, color: "var(--text2)" }}>📧 We emailed a confirmation link to <b>{emailSent}</b>. Tap it, then come back here.</p>
          ) : (
            <button className="btn" style={{ ...btn, background: "transparent", color: "var(--text2)", border: "1px solid var(--border, #cbd5e1)", marginTop: 0 }} disabled={busy} onClick={sendEmail}>
              No WhatsApp? Confirm by email instead
            </button>
          )}
        </div>
        {!v.blocked && (
          <button className="btn" style={{ ...btn, background: "transparent", color: "var(--text3)", fontWeight: 500 }} onClick={() => navigate("/")}>Later</button>
        )}
      </div>
    </div>
  );
}
