import { useEffect, useState } from "react";
import api from "../lib/api";

const medal = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/leaderboard").then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!data) return null;

  const { board, me } = data;

  const Row = ({ row }) => (
    <div
      className="card"
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 8,
        border: row.isMe ? "1.5px solid var(--blue-mid)" : undefined,
        background: row.isMe ? "var(--blue-light)" : undefined,
      }}
    >
      <div style={{ width: 32, textAlign: "center", fontSize: 16, fontWeight: 800, color: "var(--text3)" }}>
        {medal[row.rank] || `#${row.rank}`}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{row.name}{row.isMe && <span style={{ color: "var(--blue-mid)" }}> (You)</span>}</div>
        <div style={{ fontSize: 11.5, color: "var(--text3)" }}>Level {row.level} · 🔥 {row.streak} day streak</div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--purple)" }}>{row.xp.toLocaleString()} XP</div>
    </div>
  );

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🏆 Leaderboard</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Top 20 YNeet students by XP — solve mocks, quizzes, and practice to climb.</p>
        </div>
      </div>

      {board.map((row) => <Row key={row.rank} row={row} />)}

      {me.outsideTop20 && (
        <>
          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, margin: "12px 0" }}>· · ·</div>
          <Row row={me} />
        </>
      )}
    </div>
  );
}
