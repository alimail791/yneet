import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import creatorApi, { CREATOR_TOKEN, errMsg } from "../../lib/creatorApi";

// /creator/forgot — reset a creator's password with a 6-digit code sent by email.
export default function CreatorForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email → code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sendCode = async (e) => {
    e?.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      const { data } = await creatorApi.post("/creator/forgot-password", { email });
      setInfo(data.message);
      setStep("code");
    } catch (err) { setError(errMsg(err, "Couldn't send the code")); }
    setBusy(false);
  };

  const reset = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const { data } = await creatorApi.post("/creator/reset-password", { email, code, password });
      try { localStorage.setItem(CREATOR_TOKEN, data.token); } catch { /* storage unavailable */ }
      navigate("/creator", { replace: true });
    } catch (err) { setError(errMsg(err, "Couldn't reset the password")); }
    setBusy(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">YNeet Creators</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Reset your password</h2>

        {step === "email" ? (
          <form onSubmit={sendCode}>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 14 }}>Enter the email you signed up with. We'll email you a 6-digit code.</p>
            <div className="form-group"><label className="form-label">Email</label>
              <input className="form-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-blue btn-full" disabled={busy} style={{ padding: "12px 0" }}>{busy ? "Sending…" : "Send code"}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 14 }}>{info} Check your spam folder too.</p>
            <div className="form-group"><label className="form-label">6-digit code</label>
              <input className="form-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ letterSpacing: 4, fontWeight: 700 }} /></div>
            <div className="form-group"><label className="form-label">New password<span className="optional-tag">at least 8 characters</span></label>
              <input className="form-input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
            {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-blue btn-full" disabled={busy || code.length !== 6} style={{ padding: "12px 0" }}>{busy ? "Saving…" : "Set new password"}</button>
            <button type="button" className="btn btn-outline btn-full" style={{ marginTop: 10 }} onClick={sendCode} disabled={busy}>Send a new code</button>
          </form>
        )}

        <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 16 }}>
          Remembered it? <Link to="/creator/login" style={{ color: "var(--blue-mid)", fontWeight: 700 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
