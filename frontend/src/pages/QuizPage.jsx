import { useState, useEffect } from "react";
import api from "../lib/api";

export default function QuizPage() {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/quiz/daily")
      .then(r => setQuestions(r.data.questions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const answer = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    setAnswers(a => [...a, { questionId: questions[current].id, selected: idx }]);
  };

  const next = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      submit();
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.post("/quiz/submit", { answers });
      setResults(r.data);
    } catch { alert("Could not submit. Try again."); }
    setSubmitting(false);
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  if (results) return (
    <div>
      <div className="card text-center mb-5" style={{ padding: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Quiz Complete!</h2>
        <div style={{ fontSize: 44, fontWeight: 800, color: "var(--blue)", marginBottom: 4 }}>
          {results.correct}<span style={{ fontSize: 22, color: "var(--text3)" }}>/{results.total}</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 6 }}>
          {Math.round(results.correct / results.total * 100)}% accuracy
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
          <span className="chip chip-green">Biology: {results.results?.filter(r => questions.find(q => q.id === r.questionId)?.subject === "Biology" && r.isCorrect).length || 0}/{questions.filter(q => q.subject === "Biology").length}</span>
          <span className="chip chip-blue">Physics: {results.results?.filter(r => questions.find(q => q.id === r.questionId)?.subject === "Physics" && r.isCorrect).length || 0}/{questions.filter(q => q.subject === "Physics").length}</span>
          <span className="chip chip-amber">Chemistry: {results.results?.filter(r => questions.find(q => q.id === r.questionId)?.subject === "Chemistry" && r.isCorrect).length || 0}/{questions.filter(q => q.subject === "Chemistry").length}</span>
        </div>
        <button className="btn btn-blue" style={{ marginTop: 20 }} onClick={() => { setResults(null); setCurrent(0); setAnswers([]); setSelected(null); setRevealed(false); }}>
          Try Again Tomorrow
        </button>
      </div>
      <div className="section-title mb-4">Review Answers</div>
      {results.results?.map((r, i) => {
        const q = questions.find(q => q.id === r.questionId);
        if (!q) return null;
        return (
          <div key={i} className="card mb-4" style={{ borderLeft: `3px solid ${r.isCorrect ? "var(--green)" : "var(--red)"}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span className={`chip ${q.subject === "Biology" ? "chip-green" : q.subject === "Physics" ? "chip-blue" : "chip-amber"}`}>{q.subject}</span>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{q.chapter}</span>
              <span className={`chip ${r.isCorrect ? "chip-green" : "chip-red"}`}>{r.isCorrect ? "✓ Correct" : "✗ Wrong"}</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>{q.questionText}</p>
            <div style={{ fontSize: 13, color: "var(--green)", marginBottom: 8 }}>
              <strong>Correct: {["A", "B", "C", "D"][r.correctOpt]}) {[q.optionA, q.optionB, q.optionC, q.optionD][r.correctOpt]}</strong>
            </div>
            <div style={{ background: "var(--gray2)", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
              {r.explanation}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!questions.length) return (
    <div className="card text-center" style={{ padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
      <h3>No quiz questions available</h3>
      <p style={{ color: "var(--text2)", marginTop: 8 }}>Run <code>npm run db:seed</code> in the backend to add questions.</p>
    </div>
  );

  const q = questions[current];
  const bioCount = questions.filter(q => q.subject === "Biology").length;
  const phyCount = questions.filter(q => q.subject === "Physics").length;
  const chemCount = questions.filter(q => q.subject === "Chemistry").length;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div>
      <div className="section-header mb-4">
        <div>
          <div className="section-title">⚡ Daily Quiz</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>{questions.length} Questions · Biology({bioCount}) + Physics({phyCount}) + Chemistry({chemCount})</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip chip-green">Bio: {bioCount}</span>
          <span className="chip chip-blue">Phy: {phyCount}</span>
          <span className="chip chip-amber">Chem: {chemCount}</span>
        </div>
      </div>

      <div className="card mb-4">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className={`chip ${q.subject === "Biology" ? "chip-green" : q.subject === "Physics" ? "chip-blue" : "chip-amber"}`}>
            {q.subject} · {q.chapter}
          </span>
          <span style={{ fontSize: 13, color: "var(--text3)" }}>Q {current + 1} / {questions.length}</span>
        </div>
        <div className="prog-bar mb-4">
          <div className="prog-fill prog-blue" style={{ width: `${progress}%` }}></div>
        </div>

        <p className="quiz-q">{q.questionText}</p>

        {["optionA", "optionB", "optionC", "optionD"].map((key, idx) => (
          <div
            key={key}
            className={`quiz-opt ${revealed ? "locked" : ""} ${selected === idx ? (idx === q.correctOpt ? "correct" : "wrong") : ""} ${revealed && idx === q.correctOpt ? "correct" : ""}`}
            onClick={() => answer(idx)}
          >
            <div className="opt-key">{"ABCD"[idx]}</div>
            {q[key]}
          </div>
        ))}

        {revealed && (
          <div style={{ marginTop: 14, background: "var(--green-light)", borderLeft: "3px solid var(--green)", padding: "12px 16px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7 }}>
            <strong style={{ color: "var(--green)" }}>{selected === q.correctOpt ? "✅ Correct! " : "❌ Incorrect. "}</strong>
            Correct answer: <strong>{["A","B","C","D"][q.correctOpt]}) {[q.optionA,q.optionB,q.optionC,q.optionD][q.correctOpt]}</strong>
          </div>
        )}

        {revealed && (
          <button className="btn btn-blue" style={{ marginTop: 14 }} onClick={next} disabled={submitting}>
            {current < questions.length - 1 ? "Next Question →" : submitting ? "Submitting..." : "Submit Quiz ✓"}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Progress</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: 24, height: 24, borderRadius: 4, background: i < current ? "var(--green)" : i === current ? "var(--blue)" : "var(--gray3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: i <= current ? "#fff" : "var(--text3)", fontWeight: 600 }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}