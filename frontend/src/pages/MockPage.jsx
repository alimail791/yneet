import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function MockPage() {
  const [tests, setTests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/mock").then(r => setTests(r.data.tests || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startTest = async (testId) => {
    try {
      const { data } = await api.post(`/mock/${testId}/start`);
      navigate(`/mock/${data.attempt.id}/start`, { state: { attempt: data.attempt, questions: data.questions, test: data.test } });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to start test");
    }
  };

  const typeColor = { full: "var(--blue-mid)", subject: "var(--amber)", chapter: "var(--green)" };

  const filtered = tests.filter(t =>
    filter === "all" ? true :
    filter === "full" ? t.type === "full" :
    filter === "bio" ? t.subject === "Biology" :
    filter === "phy" ? t.subject === "Physics" :
    filter === "chem" ? t.subject === "Chemistry" : true
  );

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  const fullTests = tests.filter(t => t.type === "full");
  const subjectTests = tests.filter(t => t.type === "subject");
  const completedFull = fullTests.filter(t => t.lastAttempt?.status === "submitted").length;

  return (
    <div>
      <div className="section-header mb-4">
        <div>
          <div className="section-title">📝 Mock Tests</div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
            {fullTests.length} Full Tests · {subjectTests.length} Subject Tests · {completedFull} completed
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid4 mb-5">
        <div className="card"><div className="card-title">Total Tests</div><div className="card-value" style={{ color: "var(--blue)" }}>{tests.length}</div><div className="card-sub">30 in total</div></div>
        <div className="card"><div className="card-title">Full Length</div><div className="card-value" style={{ color: "var(--purple)" }}>{fullTests.length}</div><div className="card-sub">720 marks each</div></div>
        <div className="card"><div className="card-title">Subject Tests</div><div className="card-value" style={{ color: "var(--green)" }}>{subjectTests.length}</div><div className="card-sub">Bio+Phy+Chem</div></div>
        <div className="card"><div className="card-title">Completed</div><div className="card-value" style={{ color: "var(--amber)" }}>{tests.filter(t => t.lastAttempt?.status === "submitted").length}</div><div className="card-sub">attempts done</div></div>
      </div>

      {/* Filter Tabs */}
      <div className="chip-row mb-5">
        {[["all", "All Tests"], ["full", "Full Length (20)"], ["bio", "Biology (5)"], ["phy", "Physics (5)"], ["chem", "Chemistry (5)"]].map(([val, label]) => (
          <span key={val} onClick={() => setFilter(val)} className="chip" style={{ cursor: "pointer", background: filter === val ? "var(--blue-light)" : "var(--gray2)", color: filter === val ? "var(--blue)" : "var(--text2)" }}>{label}</span>
        ))}
      </div>

      <div className="grid3">
        {filtered.map(test => {
          const done = test.lastAttempt?.status === "submitted";
          const inProgress = test.lastAttempt?.status === "in_progress";
          return (
            <div key={test.id} className="card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: typeColor[test.type] || "var(--blue)" }}></div>
              <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                {test.type === "full" ? "Full Length" : `${test.subject} · Subject`}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 6px" }}>{test.title}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <span>⏱ {test.durationMin}m</span>
                <span>📝 {test.totalQs} Qs</span>
                <span>🎯 {test.totalMarks} marks</span>
              </div>
              {done && (
                <div style={{ marginBottom: 10 }}>
                  <span className="chip chip-green">Done · {test.lastAttempt.score}/{test.totalMarks}</span>
                </div>
              )}
              {done ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/mock/${test.lastAttempt.id}/analysis`)}>Analysis</button>
                  <button className="btn btn-blue btn-sm" style={{ flex: 1 }} onClick={() => startTest(test.id)}>Retake</button>
                </div>
              ) : inProgress ? (
                <button className="btn btn-amber btn-full btn-sm" onClick={() => navigate(`/mock/${test.lastAttempt.id}/start`, { state: { attempt: test.lastAttempt, questions: [], test } })}>
                  ▶ Resume Test
                </button>
              ) : (
                <button className="btn btn-blue btn-full btn-sm" onClick={() => startTest(test.id)}>Start Test →</button>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="card text-center" style={{ padding: 40 }}>
          <p style={{ color: "var(--text3)" }}>No tests found. Run <code>npm run db:seed</code> to add tests.</p>
        </div>
      )}
    </div>
  );
}
