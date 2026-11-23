import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { shareChallenge } from "../utils/challenge";

// Free weekly All-India NEET Mock (every Sunday). Backend: routes/allIndia.js.
const fmtLeft = (ms) => {
  if (ms <= 0) return "";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function Board({ rows, totalMarks }) {
  if (!rows?.length) return <p style={{ fontSize: 13, color: "var(--text3)" }}>No ranked students yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => (
        <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: r.me ? "var(--blue-light)" : "var(--gray2)", fontWeight: r.me ? 700 : 500 }}>
          <span style={{ width: 34, fontWeight: 800 }}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}</span>
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}{r.me ? " (you)" : ""}{r.place && <span style={{ color: "var(--text3)", fontWeight: 400 }}> · {r.place}</span>}</span>
          <span style={{ fontSize: 14 }}>{r.score}/{totalMarks}</span>
        </div>
      ))}
    </div>
  );
}

export default function AllIndiaPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/allindia").then((r) => setData(r.data)).catch(() => setData({ error: true })); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const start = async () => {
    setBusy(true);
    try {
      const { data: d } = await api.post(`/mock/${data.current.testId}/start`);
      navigate(`/mock/${d.attempt.id}/start`, { state: { attempt: d.attempt, questions: d.questions, test: d.test } });
    } catch (e) { setBusy(false); alert(e?.response?.data?.message || "Couldn't start the test. Try again."); }
  };

  if (!data) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (data.error) return <div className="card text-center" style={{ padding: 30 }}>Couldn't load the All-India Mock. Please try again.</div>;
  if (!data.eligible) return <div className="card text-center" style={{ padding: 30 }}>{data.message}</div>;

  const { current: c, last } = data;
  const live = c.status === "live" || (c.status === "upcoming" && now >= new Date(c.opensAt).getTime());
  const my = c.myAttempt;

  return (
    <div>
      <div className="section-title mb-2" style={{ fontSize: 22 }}>🏆 All-India NEET Mock</div>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
        Free every Sunday for all NEET aspirants · {c.totalQs} questions · {c.durationMin} min · +4 / −1 marking · All-India rank
      </p>

      <div className="card mb-5" style={{ background: "linear-gradient(135deg,var(--blue-mid),var(--purple))", color: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, opacity: 0.85 }}>
          {live ? "🔴 Live now" : c.status === "closed" ? "Finished" : "Next mock"} · Sunday {c.label}
        </div>
        {my?.status === "submitted" ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>Done! You scored {my.score}{c.totalMarks ? `/${c.totalMarks}` : ""}</div>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>Final ranks are out on Monday. Challenge friends to take it today.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" style={{ background: "#25D366", color: "#fff", fontWeight: 700 }} onClick={() => shareChallenge({ attemptId: my.id, score: my.score, totalMarks: c.totalMarks, title: `All-India NEET Mock (${c.label})` })}>Challenge friends</button>
              <button className="btn" style={{ background: "#fff", color: "var(--blue-mid)", fontWeight: 700 }} onClick={() => navigate(`/mock/${my.id}/analysis`)}>My analysis</button>
            </div>
          </>
        ) : live ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>{my?.status === "in_progress" ? "Your test is in progress" : "Take it now — it's free"}</div>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>Open until 11:59 PM tonight. Your first attempt today is ranked. {fmtLeft(new Date(c.closesAt) - now)} left.</p>
            <button className="btn" disabled={busy || !c.testId} style={{ background: "#fff", color: "var(--blue-mid)", fontWeight: 800 }} onClick={start}>
              {busy ? "Starting…" : my?.status === "in_progress" ? "▶ Resume test" : "Start All-India Mock →"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>Opens in {fmtLeft(new Date(c.opensAt) - now)}</div>
            <p style={{ fontSize: 13, opacity: 0.9 }}>Sunday 12:00 AM to 11:59 PM. Turn on reminders and invite your friends to compete with you.</p>
          </>
        )}
      </div>

      {live && c.board && (
        <div className="card mb-5">
          <div className="section-title mb-2" style={{ fontSize: 15 }}>Live top 10 · {c.board.takers} students so far</div>
          <Board rows={c.board.top} totalMarks={c.board.totalMarks} />
        </div>
      )}

      {last && (
        <div className="card mb-5">
          <div className="section-title mb-1" style={{ fontSize: 15 }}>Results · Sunday {last.label}</div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>{last.takers} students ranked</p>
          {last.me && (
            <div style={{ padding: 14, borderRadius: 12, background: "var(--green-light, #dcfce7)", marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Your All-India rank: #{last.me.rank} of {last.takers}</div>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>Score {last.me.score}/{last.totalMarks} · better than {last.me.percentile}% of students</div>
              <button className="btn btn-sm" style={{ marginTop: 8, background: "#25D366", color: "#fff", fontWeight: 700 }}
                onClick={() => shareChallenge({ attemptId: last.me.attemptId, score: last.me.score, totalMarks: last.totalMarks, title: `All-India NEET Mock — I ranked #${last.me.rank} of ${last.takers}` })}>
                Share my rank & challenge friends
              </button>
            </div>
          )}
          <Board rows={last.top} totalMarks={last.totalMarks} />
          {!last.me && (
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/mock?filter=all`)}>Practise for next Sunday</button>
          )}
        </div>
      )}
    </div>
  );
}
