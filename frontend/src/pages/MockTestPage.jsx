import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function MockTestPage() {
  const { attemptId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(state?.questions || []);
  const [test, setTest] = useState(state?.test || {});
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState({});
  const [secsLeft, setSecsLeft] = useState((state?.test?.durationMin || 200) * 60);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!questions.length && state?.test?.id) {
      api.post(`/mock/${state.test.id}/start`).then(r => { setQuestions(r.data.questions); setTest(r.data.test); }).catch(() => {});
    }
  }, []);

  const submitTest = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current);
    const timeTaken = (test?.durationMin || 200) * 60 - secsLeft;
    try {
      await api.post(`/mock/${attemptId}/submit`, { timeTaken });
      navigate(`/mock/${attemptId}/analysis`);
    } catch (err) {
      const msg = err?.response?.data?.message || "Submission failed. Try again.";
      alert(`Submission failed: ${msg}`);
      setSubmitting(false);
    }
  }, [submitting, secsLeft, attemptId, test, navigate]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecsLeft(s => { if (s <= 1) { clearInterval(timerRef.current); submitTest(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const fmt = s => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

  const selectOpt = async (idx) => {
    const q = questions[current];
    setResponses(r => ({ ...r, [q.id]: { ...r[q.id], selected: idx } }));
    await api.post(`/mock/${attemptId}/response`, { questionId: q.id, selected: idx, isMarked: responses[q.id]?.marked || false, timeSec: 0 }).catch(() => {});
  };

  const toggleMark = async () => {
    const q = questions[current];
    const marked = !responses[q.id]?.marked;
    setResponses(r => ({ ...r, [q.id]: { ...r[q.id], marked } }));
    await api.post(`/mock/${attemptId}/response`, { questionId: q.id, selected: responses[q.id]?.selected ?? null, isMarked: marked, timeSec: 0 }).catch(() => {});
  };

  if (!questions.length) return <div className="loading-screen"><div className="spinner"></div><p>Loading test...</p></div>;

  const q = questions[current];
  const resp = responses[q.id];
  const answered = Object.values(responses).filter(r => r.selected !== undefined && r.selected !== null).length;
  const subjectColor = { Physics: "var(--blue)", Chemistry: "var(--amber)", Biology: "var(--green)" };

  return (
    <div>
      {/* Header */}
      <div className="test-header mb-0" style={{ borderRadius: "var(--r) var(--r) 0 0", marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 12, opacity: .8 }}>{test?.title || "NEET Mock Test"}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Q.{current + 1}/{questions.length} · <span style={{ color: subjectColor[q.subject] || "#fff" }}>{q.subject}</span></div>
        </div>
        <div className="test-timer" style={{ color: secsLeft < 600 ? "#fca5a5" : "#fff" }}>{fmt(secsLeft)}</div>
        <button onClick={() => { if (window.confirm("Submit test? This cannot be undone.")) submitTest(); }}
          style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>

      <div className="grid2" style={{ alignItems: "start", background: "#fff", border: "1px solid var(--gray3)", borderTop: "none", borderRadius: "0 0 var(--r) var(--r)", padding: 20, gap: 20, marginBottom: 20 }}>
        {/* Question */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span className={`chip ${q.subject === "Biology" ? "chip-green" : q.subject === "Physics" ? "chip-blue" : "chip-amber"}`}>{q.subject}</span>
            <span style={{ fontSize: 12, color: "var(--text2)" }}>{q.chapter} · {q.topic}</span>
            {q.isPYQ && <span className="pyq-badge">PYQ {q.pyqYear}</span>}
            <span style={{ fontSize: 11, color: q.difficulty === "hard" ? "var(--red)" : q.difficulty === "easy" ? "var(--green)" : "var(--amber)", fontWeight: 600, textTransform: "uppercase" }}>{q.difficulty}</span>
          </div>
          <p className="quiz-q">{q.questionText}</p>
          {["optionA", "optionB", "optionC", "optionD"].map((key, idx) => (
            <div key={key} className={`quiz-opt ${resp?.selected === idx ? "selected" : ""}`} onClick={() => selectOpt(idx)}>
              <div className="opt-key">{"ABCD"[idx]}</div>{q[key]}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${resp?.marked ? "btn-purple" : "btn-outline"}`} onClick={toggleMark}>
              🔖 {resp?.marked ? "Marked" : "Mark for Review"}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setResponses(r => ({ ...r, [q.id]: { ...r[q.id], selected: null } }))} disabled={resp?.selected === undefined || resp?.selected === null}>Clear</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>← Prev</button>
              <button className="btn btn-blue btn-sm" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>Next →</button>
            </div>
          </div>
        </div>

        {/* Navigator */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Navigator · {answered}/{questions.length} answered</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, fontSize: 11, color: "var(--text3)", flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--green)", borderRadius: 2, marginRight: 3 }}></span>Answered</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--purple)", borderRadius: 2, marginRight: 3 }}></span>Marked</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, border: "1.5px solid var(--gray3)", borderRadius: 2, marginRight: 3 }}></span>Unanswered</span>
          </div>
          <div className="q-nav" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
            {questions.map((question, i) => {
              const r = responses[question.id];
              const cls = i === current ? "current" : r?.marked ? "marked" : (r?.selected !== undefined && r?.selected !== null) ? "answered" : "";
              return <div key={i} className={`q-num ${cls}`} onClick={() => setCurrent(i)}>{i + 1}</div>;
            })}
          </div>
          <div style={{ marginTop: 14, background: "var(--gray2)", borderRadius: 8, padding: 12, fontSize: 13 }}>
            <div className="prog-bar" style={{ marginBottom: 6 }}><div className="prog-fill prog-green" style={{ width: `${(answered / questions.length) * 100}%` }}></div></div>
            <span style={{ color: "var(--text3)" }}>{answered} of {questions.length} answered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
