import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/api";

// Opened from the confirmation email — works without being logged in.
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState("checking");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api.post("/public/verify-email", { token: params.get("token") || "" })
      .then(() => {
        setState("ok");
        // Make the next /auth/me (if logged in on this device) pick up the change.
        try { const u = JSON.parse(localStorage.getItem("yneet_user")); if (u) { u.isVerified = true; u.verification = { required: false, blocked: false }; localStorage.setItem("yneet_user", JSON.stringify(u)); } } catch { /* ignore */ }
      })
      .catch((e) => { setState("bad"); setMessage(e?.response?.data?.message || "This link isn't valid."); });
  }, []); // eslint-disable-line
  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "64px 20px", textAlign: "center" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", background: "var(--white, #fff)", borderRadius: 18, padding: 32 }}>
        {state === "checking" && <p style={{ color: "var(--text2)" }}>Confirming your email…</p>}
        {state === "ok" && (<>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>✅ Email confirmed</h1>
          <p style={{ color: "var(--text2)", marginTop: 8 }}>Your free YNeet trial is all set.</p>
          <Link to="/" className="btn" style={{ display: "inline-block", marginTop: 18, background: "var(--blue-mid)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 700 }}>Open YNeet</Link>
        </>)}
        {state === "bad" && (<>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>Link expired</h1>
          <p style={{ color: "var(--text2)", marginTop: 8 }}>{message}</p>
          <Link to="/verify" className="btn" style={{ display: "inline-block", marginTop: 18, background: "var(--blue-mid)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 700 }}>Verify another way</Link>
        </>)}
      </div>
    </div>
  );
}
