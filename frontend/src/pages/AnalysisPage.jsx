import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale, Tooltip } from "chart.js";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { isJuniorFree } from "../utils/plan";
ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip);

export default function AnalysisPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/mock/${attemptId}/analysis`).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!data) return <p>Analysis not found.</p>;

  const { attempt, chapterAnalysis, plan = [], time } = data;
  const subjColor = (sub) => (sub === "Physics" ? "var(--blue)" : sub === "Chemistry" ? "var(--amber)" : "var(--green)");
  const mmss = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`);
  const subjectData = {
    labels: ["Physics", "Chemistry", "Biology"],
    datasets: [{ label: "Score", data: [attempt.physicsScore, attempt.chemScore, attempt.bioScore], backgroundColor: ["rgba(37,99,235,.8)", "rgba(217,119,6,.8)", "rgba(5,150,105,.8)"], borderRadius: 8 }]
  };
  const correctCount = data.attempt.responses?.filter(r => r.isCorrect).length || 0;
  const answeredCount = data.attempt.responses?.filter(r => r.selected !== null).length || 0;

  return (
    <div>
      <div className="section-header mb-5">
        <div className="section-title">Test Analysis — {attempt.mockTest?.title}</div>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/mock")}>← Back to Tests</button>
      </div>

      <div className="grid4 mb-5">
        <div className="card"><div className="card-title">Score</div><div className="card-value" style={{ color: "var(--blue)" }}>{attempt.score}</div><div className="card-sub">out of {attempt.totalMarks}</div></div>
        <div className="card"><div className="card-title">Accuracy</div><div className="card-value" style={{ color: "var(--green)" }}>{attempt.accuracy?.toFixed(1)}%</div><div className="card-sub">{correctCount}/{answeredCount} correct</div></div>
        <div className="card"><div className="card-title">Time Taken</div><div className="card-value" style={{ color: "var(--amber)" }}>{Math.floor(attempt.timeTaken / 60)}m</div><div className="card-sub">{attempt.timeTaken}s total</div></div>
        <div className="card"><div className="card-title">Unattempted</div><div className="card-value" style={{ color: "var(--red)" }}>{(attempt.mockTest?.totalQs || 0) - answeredCount}</div><div className="card-sub">questions skipped</div></div>
      </div>

      {plan.length > 0 && (
        <div className="card mb-5" style={{ borderColor: "var(--blue-light)" }}>
          <div className="section-title mb-4">What to do next</div>
          <ol className="plan-list">
            {plan.map((step, i) => (
              <li key={i} className="plan-item">
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  {step.action && <Link className="btn btn-blue btn-sm" to={step.action.to}>{step.action.label} →</Link>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {time && (
        <div className="grid2 mb-5">
          <div className="card">
            <div className="section-title mb-4">Time per question</div>
            {time.bySubject.map((sub) => {
              const max = Math.max(...time.bySubject.map((x) => Math.max(x.avgSec, x.targetSec))) * 1.15;
              const slow = sub.avgSec > sub.targetSec * 1.3;
              return (
                <div key={sub.subject} className="pace-row">
                  <span style={{ color: subjColor(sub.subject), fontWeight: 700 }}>{sub.subject}</span>
                  <div className="pace-bar" aria-hidden="true">
                    <div className="pace-fill" style={{ width: `${(sub.avgSec / max) * 100}%`, background: slow ? "var(--red)" : subjColor(sub.subject) }} />
                    <div className="pace-target" style={{ left: `${(sub.targetSec / max) * 100}%` }} />
                  </div>
                  <span><b style={{ color: slow ? "var(--red)" : "inherit" }}>{sub.avgSec}s</b> <span style={{ color: "var(--text3)" }}>/ {sub.targetSec}s</span></span>
                </div>
              );
            })}
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Bar = your average. Line = a good NEET pace for that subject.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
              <span className="chip chip-red">⏱ {mmss(time.wrongSec)} spent on wrong answers</span>
              {time.quickGuesses.total > 0 && <span className="chip chip-amber">{time.quickGuesses.wrong}/{time.quickGuesses.total} quick guesses wrong</span>}
            </div>
          </div>
          <div className="card">
            <div className="section-title mb-4">Questions that took longest</div>
            {time.slowest.map((q) => (
              <div key={q.questionId} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--gray3)", fontSize: 13 }}>
                <b style={{ minWidth: 52 }}>{mmss(q.timeSec)}</b>
                <span style={{ flex: 1, color: "var(--text2)" }}><span style={{ color: subjColor(q.subject), fontWeight: 600 }}>{q.chapter}</span> · {q.text}{q.text.length >= 120 ? "…" : ""}</span>
                <span style={{ color: q.isCorrect ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{q.isCorrect ? "✓" : "✗"}</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>In the exam, move on after 2 minutes and come back at the end.</p>
          </div>
        </div>
      )}

      <div className="grid2 mb-5">
        <div className="card">
          <div className="section-title mb-4">Subject Scores</div>
          <div style={{ height: 200 }}><Bar data={subjectData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, grid: { color: "rgba(0,0,0,.04)" } }, x: { grid: { display: false } } } }} /></div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "center", fontSize: 13 }}>
            <span style={{ color: "var(--blue)" }}>Physics: {attempt.physicsScore}</span>
            <span style={{ color: "var(--amber)" }}>Chem: {attempt.chemScore}</span>
            <span style={{ color: "var(--green)" }}>Bio: {attempt.bioScore}</span>
          </div>
        </div>
        <div className="card">
          <div className="section-title mb-4">Performance Summary</div>
          {[
            ["Correct Answers", correctCount, "green"],
            ["Wrong Answers", answeredCount - correctCount, "red"],
            ["Unattempted", (attempt.mockTest?.totalQs || 0) - answeredCount, "amber"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ marginBottom: 14 }}>
              <div className="subj-row"><span>{l}</span><span style={{ color: `var(--${c})` }}>{v}</span></div>
              <div className="prog-bar"><div className={`prog-fill prog-${c}`} style={{ width: `${Math.round(v / (attempt.mockTest?.totalQs || 1) * 100)}%` }}></div></div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: 12, background: "var(--blue-light)", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)", marginBottom: 4 }}>Estimated Rank</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--blue)" }}>
              {attempt.score >= 680 ? "AIR ~500" : attempt.score >= 650 ? "AIR ~2,000" : attempt.score >= 600 ? "AIR ~8,000" : attempt.score >= 550 ? "AIR ~20,000" : attempt.score >= 500 ? "AIR ~45,000" : "AIR ~90,000+"}
            </div>
          </div>
        </div>
      </div>

      {chapterAnalysis?.length > 0 && (
        <div className="card mb-5">
          <div className="section-title mb-4">Chapter-wise Breakdown (Weakest → Strongest)</div>
          {chapterAnalysis.map((c, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="subj-row">
                <span><strong style={{ color: c.subject === "Biology" ? "var(--green)" : c.subject === "Physics" ? "var(--blue)" : "var(--amber)" }}>{c.subject}</strong> · {c.chapter}</span>
                <span style={{ color: c.accuracy < 50 ? "var(--red)" : c.accuracy < 75 ? "var(--amber)" : "var(--green)" }}>{c.accuracy}% ({c.correct}/{c.total})</span>
              </div>
              <div className="prog-bar"><div className={`prog-fill ${c.accuracy < 50 ? "prog-red" : c.accuracy < 75 ? "prog-amber" : "prog-green"}`} style={{ width: `${c.accuracy}%` }}></div></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-blue" onClick={() => navigate("/mock")}>← Back to Tests</button>
        {!isJuniorFree(user) && <button className="btn btn-outline" onClick={() => navigate("/mistakes?source=mock")}>View Mistakes →</button>}
      </div>
    </div>
  );
}
