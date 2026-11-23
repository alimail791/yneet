import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Home for Class 9–Dropper students whose trial/plan has ended. They keep one
// free Daily/Chapter test a day, and the two ways back to full access
// (invite friends, or pick a plan) are right in front of them.
export default function FreeHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const first = (user?.name || "").split(" ")[0];

  return (
    <div>
      <div className="section-title mb-2" style={{ fontSize: 22 }}>Hi {first || "there"} 👋</div>
      <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>
        Your full-access period has ended, but your NEET practice doesn't stop. You get <strong>1 free test every day</strong>.
      </p>

      <div className="card" style={{ marginBottom: 14, borderLeft: "4px solid var(--blue)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📝 Today's free test</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>Pick any Daily Practice or Chapter Test. Keep your streak going.</p>
        <button className="btn btn-blue btn-full" onClick={() => navigate("/mock?filter=daily")}>Take today's free test →</button>
      </div>

      <div className="card" style={{ marginBottom: 14, borderLeft: "4px solid var(--amber)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🏆 All-India NEET Mock — every Sunday, free</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>90 questions, real NEET marking, your All-India rank. Doesn't use your daily free test.</p>
        <button className="btn btn-outline btn-full" onClick={() => navigate("/all-india")}>Open All-India Mock</button>
      </div>

      <div className="card" style={{ marginBottom: 14, background: "linear-gradient(135deg,var(--blue-mid),var(--purple))", color: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🎁 Get 1 month free</div>
        <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
          Invite 2 friends — each friend who confirms their WhatsApp number gives you 15 days of full access. Your friends get 45 days free.
        </p>
        <button className="btn btn-full" style={{ background: "#fff", color: "var(--blue-mid)", fontWeight: 700 }} onClick={() => navigate("/referral")}>Invite friends</button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🔓 Unlock everything</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>Full mock tests, PYQs, practice, Shorts, planner and doubt support.</p>
        <button className="btn btn-outline btn-full" onClick={() => navigate("/pricing")}>See plans</button>
      </div>
    </div>
  );
}
