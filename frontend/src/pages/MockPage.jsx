import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

const PAGE_SIZE = 24;

export default function MockPage() {
  const [tests, setTests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/mock").then(r => setTests(r.data.tests || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Reset pagination whenever the visible set changes shape.
  useEffect(() => { setVisible(PAGE_SIZE); }, [filter, search]);

  const startTest = async (testId) => {
    try {
      const { data } = await api.post(`/mock/${testId}/start`);
      navigate(`/mock/${data.attempt.id}/start`, { state: { attempt: data.attempt, questions: data.questions, test: data.test } });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to start test");
    }
  };

  const typeColor = { full: "var(--blue-mid)", half: "var(--purple)", subject: "var(--amber)", daily: "var(--green)", chapter: "var(--green)" };
  const typeLabel = (t) =>
    t.type === "full" ? "Full Length" :
    t.type === "half" ? "Half Length" :
    t.type === "daily" ? "Daily Practice" :
    t.type === "subject" ? `${t.subject} · Subject` : t.type;

  const fullTests = tests.filter(t => t.type === "full");
  const halfTests = tests.filter(t => t.type === "half");
  const subjectTests = tests.filter(t => t.type === "subject");
  const dailyTests = tests.filter(t => t.type === "daily");
  const completedFull = fullTests.filter(t => t.lastAttempt?.status === "submitted").length;

  const filtered = useMemo(() => tests.filter(t => {
    if (search.trim() && !t.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    switch (filter) {
      case "full": return t.type === "full";
      case "half": return t.type === "half";
      case "daily": return t.type === "daily";
      case "phy": return t.type === "subject" && t.subject === "Physics";
      case "chem": return t.type === "subject" && t.subject === "Chemistry";
      case "bio": return t.type === "subject" && t.subject === "Biology";
      default: return true;
    }
  }), [tests, filter, search]);

  const visibleTests = filtered.slice(0, visible);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-4">
        <div>
          <div className="section-title">📝 Mock Tests</div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
            {fullTests.length} Full · {halfTests.length} Half · {subjectTests.length} Subject · {dailyTests.length} Daily · {completedFull} full tests completed
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid4 mb-5">
        <div className="card"><div className="card-title">Total Tests</div><div className="card-value" style={{ color: "var(--blue)" }}>{tests.length}</div><div className="card-sub">{tests.length} in total</div></div>
        <div className="card"><div className="card-title">Full Length</div><div className="card-value" style={{ color: "var(--purple)" }}>{fullTests.length}</div><div className="card-sub">720 marks each</div></div>
        <div className="card"><div className="card-title">Subject Tests</div><div className="card-value" style={{ color: "var(--green)" }}>{subjectTests.length}</div><div className="card-sub">Bio+Phy+Chem</div></div>
        <div className="card"><div className="card-title">Completed</div><div className="card-value" style={{ color: "var(--amber)" }}>{tests.filter(t => t.lastAttempt?.status === "submitted").length}</div><div className="card-sub">attempts done</div></div>
      </div>

      {/* Filter Tabs */}
      <div className="chip-row mb-3" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[
          ["all", `All Tests (${tests.length})`],
          ["full", `Full Length (${fullTests.length})`],
          ["half", `Half Length (${halfTests.length})`],
          ["phy", `Physics (${subjectTests.filter(t => t.subject === "Physics").length})`],
          ["chem", `Chemistry (${subjectTests.filter(t => t.subject === "Chemistry").length})`],
          ["bio", `Biology (${subjectTests.filter(t => t.subject === "Biology").length})`],
          ["daily", `Daily Practice (${dailyTests.length})`],
        ].map(([val, label]) => (
          <span key={val} onClick={() => setFilter(val)} className="chip" style={{ cursor: "pointer", background: filter === val ? "var(--blue-light)" : "var(--gray2)", color: filter === val ? "var(--blue)" : "var(--text2)" }}>{label}</span>
        ))}
      </div>

      <input
        className="form-input mb-5"
        style={{ maxWidth: 320 }}
        placeholder="Search tests by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid3">
        {visibleTests.map(test => {
          const done = test.lastAttempt?.status === "submitted";
          const inProgress = test.lastAttempt?.status === "in_progress";
          return (
            <div key={test.id} className="card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: typeColor[test.type] || "var(--blue)" }}></div>
              <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                {typeLabel(test)}
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
      {visible < filtered.length && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setVisible(v => v + PAGE_SIZE)}>
            Show more ({filtered.length - visible} left)
          </button>
        </div>
      )}
    </div>
  );
}
