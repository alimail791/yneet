import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, LinearScale, CategoryScale, Tooltip } from "chart.js";
import api from "../lib/api";
ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip);

export default function AnalysisPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/mock/${attemptId}/analysis`).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!data) return <p>Analysis not found.</p>;

  const { attempt, chapterAnalysis } = data;
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
        <button className="btn btn-outline" onClick={() => navigate("/mistakes?source=mock")}>View Mistakes →</button>
      </div>
    </div>
  );
}
