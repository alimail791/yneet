import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { challengeFor, shareChallenge } from "../utils/challenge";

const API = import.meta.env.VITE_API_URL || "/api/v1";

// On the test analysis: "You vs <friend>" if this test was a friend's challenge,
// and a one-tap "Challenge a friend" with this exact test for every result.
export default function ChallengeCard({ attempt }) {
  const [rival, setRival] = useState(null);
  const challengeId = challengeFor(attempt.id);
  const t = attempt.mockTest || {};
  const allIndia = t.type === "allindia";

  useEffect(() => {
    if (!challengeId) return;
    axios.get(`${API}/public/challenge/${challengeId}`).then((r) => setRival(r.data.challenge)).catch(() => {});
  }, [challengeId]);

  const won = rival && attempt.score > rival.score;
  const tie = rival && attempt.score === rival.score;

  return (
    <div className="card mb-5" style={{ borderLeft: "4px solid #25D366" }}>
      {rival && (
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Challenge result</div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, margin: "6px 0" }}>
            <div><div style={{ fontSize: 28, fontWeight: 900, color: "var(--blue)" }}>{attempt.score}</div><div style={{ fontSize: 12 }}>You</div></div>
            <div style={{ fontWeight: 800, color: "var(--text3)" }}>vs</div>
            <div><div style={{ fontSize: 28, fontWeight: 900, color: "var(--purple)" }}>{rival.score}</div><div style={{ fontSize: 12 }}>{rival.name}</div></div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{won ? `🎉 You beat ${rival.name}!` : tie ? "🤝 It's a tie!" : `${rival.name} wins this round — challenge them back!`}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🏁 Challenge a friend</div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>They take this same test. You both see who scored more.</div>
        </div>
        <button className="btn" style={{ background: "#25D366", color: "#fff", fontWeight: 700 }}
          onClick={() => shareChallenge({ attemptId: attempt.id, score: attempt.score, totalMarks: attempt.totalMarks, title: t.title || "NEET mock test" })}>
          Challenge on WhatsApp
        </button>
      </div>
      {allIndia && <p style={{ fontSize: 13, marginTop: 10 }}><Link to="/all-india">🏆 See the All-India rank list →</Link></p>}
    </div>
  );
}
