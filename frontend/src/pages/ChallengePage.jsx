import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { WEBSITE_URL } from "../utils/appMode";
import { savePendingChallenge, startChallenge } from "../utils/challenge";

const API = import.meta.env.VITE_API_URL || "/api/v1";

// Public page for a challenge link (app.yneet.in/c/:attemptId), shared on WhatsApp.
// Signed in → take the same test now. New → sign up with the friend's referral
// code (45 days free); after sign-up the app brings them straight back here.
export default function ChallengePage() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/challenge/${attemptId}`)
      .then((r) => { setC(r.data.challenge); document.title = `${r.data.challenge.name} challenged you · YNeet`; })
      .catch((e) => setError(e?.response?.data?.message || "Couldn't load this challenge."));
  }, [attemptId]);

  const accept = async () => {
    if (!user) {
      savePendingChallenge(attemptId);
      try { window.gtag?.("event", "challenge_signup_click"); } catch { /* analytics only */ }
      const ref = c?.referralCode ? `ref=${encodeURIComponent(c.referralCode)}&` : "";
      window.location.href = `${WEBSITE_URL}register?${ref}from=challenge`;
      return;
    }
    setBusy(true);
    try { await startChallenge(c, navigate); }
    catch (e) { setBusy(false); if (e?.response?.data?.message) alert(e.response.data.message); }
  };

  if (error) return (
    <div className="auth-page"><div className="auth-card text-center">
      <div style={{ fontSize: 40 }}>🏁</div>
      <p style={{ fontWeight: 700, margin: "8px 0" }}>{error}</p>
      <a className="btn btn-blue" href={user ? "/mock" : WEBSITE_URL}>Take a NEET test on YNeet</a>
    </div></div>
  );
  if (!c) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <nav className="app-nav"><div className="nav-logo">YNeet 🎯</div></nav>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "28px 16px 40px" }}>
        <div className="card" style={{ textAlign: "center", padding: 28, background: "linear-gradient(135deg,var(--blue-mid),var(--purple))", color: "#fff" }}>
          <div style={{ fontSize: 44 }}>🏁</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>{c.name} challenged you</div>
          <div style={{ fontSize: 40, fontWeight: 900, margin: "6px 0" }}>{c.score}<span style={{ fontSize: 20, opacity: 0.8 }}>/{c.test.totalMarks}</span></div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{c.test.title}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{c.test.totalQs} questions · {c.test.durationMin} min · {c.accuracy}% accuracy</div>
        </div>
        <div className="card" style={{ marginTop: 14, textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Can you beat {c.name}?</p>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
            Same questions, same time limit, real NEET marking (+4 / −1).
            {!user && " Sign up free to take it — you get 45 days of full YNeet access."}
          </p>
          <button className="btn btn-blue btn-full" disabled={busy} onClick={accept}>
            {busy ? "Starting…" : user ? "Accept challenge →" : "Sign up free & accept →"}
          </button>
          {user && <button className="btn btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => navigate("/")}>Go to YNeet</button>}
        </div>
      </div>
    </div>
  );
}
