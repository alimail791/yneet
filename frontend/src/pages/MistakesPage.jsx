import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";

export default function MistakesPage() {
  const [searchParams] = useSearchParams();
  const [mistakes, setMistakes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [revealed, setRevealed] = useState({});
  const [aiExplanations, setAiExplanations] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    source: searchParams.get("source") || "",
    subject: "",
    page: 1,
  });

  const fetchMistakes = async (f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.source) params.set("source", f.source);
      if (f.subject) params.set("subject", f.subject);
      params.set("page", f.page);
      params.set("limit", 15);
      const r = await api.get(`/mistakes?${params}`);
      setMistakes(r.data.mistakes || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchMistakes(); }, []);

  const askAiMentor = async (i, questionId) => {
    setAiLoading(l => ({ ...l, [i]: true }));
    try {
      const { data } = await api.post(`/ai/explain/${questionId}`);
      setAiExplanations(e => ({ ...e, [i]: data.explanation }));
    } catch (err) {
      setAiExplanations(e => ({ ...e, [i]: err?.response?.data?.message || "AI Mentor is unavailable right now — try again later." }));
    }
    setAiLoading(l => ({ ...l, [i]: false }));
  };

  const setFilter = (k, v) => {
    const f = { ...filters, [k]: v, page: 1 };
    setFilters(f);
    fetchMistakes(f);
  };

  const sourceLabel = { mock: "Mock Test", quiz: "Daily Quiz", practice: "Practice" };
  const sourceColor = { mock: "red", quiz: "amber", practice: "purple" };

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">❌ Mistake Notebook</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>{total} mistakes tracked · Review and revise</p>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="chip-row mb-4">
        {[["all", "All Sources"], ["mock", "Mock Tests"], ["quiz", "Daily Quiz"], ["practice", "Practice"]].map(([val, label]) => (
          <span key={val} onClick={() => setFilter("source", val === "all" ? "" : val)}
            className="chip" style={{ cursor: "pointer", background: (filters.source || "all") === val ? "var(--blue-light)" : "var(--gray2)", color: (filters.source || "all") === val ? "var(--blue)" : "var(--text2)" }}>
            {label}
          </span>
        ))}
      </div>

      {/* Subject Filter */}
      <div className="chip-row mb-5">
        {[["", "All Subjects"], ["Physics", "Physics"], ["Chemistry", "Chemistry"], ["Biology", "Biology"]].map(([val, label]) => (
          <span key={val} onClick={() => setFilter("subject", val)}
            className="chip" style={{ cursor: "pointer", background: filters.subject === val ? "var(--purple-light)" : "var(--gray2)", color: filters.subject === val ? "var(--purple)" : "var(--text2)" }}>
            {label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div>
      ) : mistakes.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h3>No mistakes here!</h3>
          <p style={{ color: "var(--text2)", marginTop: 8 }}>
            {filters.source ? `No ${sourceLabel[filters.source] || ""} mistakes found.` : "Take a mock test or quiz to track mistakes."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mistakes.map((m, i) => (
            <div key={i} className="card" style={{ borderLeft: `3px solid var(--${sourceColor[m.source] || "red"})` }}>
              {/* Header */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                <span className={`chip chip-${m.question?.subject === "Biology" ? "green" : m.question?.subject === "Physics" ? "blue" : "amber"}`}>
                  {m.question?.subject}
                </span>
                <span style={{ fontSize: 12, color: "var(--text2)" }}>{m.question?.chapter} · {m.question?.topic}</span>
                <span className={`chip chip-${sourceColor[m.source] || "red"}`}>{sourceLabel[m.source] || m.source}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)" }}>
                  Wrong {m.count}x · Last: {new Date(m.lastSeen).toLocaleDateString("en-IN")}
                </span>
              </div>

              {/* Question */}
              <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, marginBottom: 12 }}>{m.question?.questionText}</p>

              {/* Options (show all, highlight correct) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                {["optionA", "optionB", "optionC", "optionD"].map((key, idx) => (
                  <div key={key} style={{
                    display: "flex", gap: 8, padding: "7px 10px", fontSize: 13, borderRadius: 8,
                    background: idx === m.question?.correctOpt ? "var(--green-light)" : "var(--gray2)",
                    border: `1.5px solid ${idx === m.question?.correctOpt ? "var(--green)" : "var(--gray3)"}`,
                    color: idx === m.question?.correctOpt ? "var(--green)" : "var(--text2)",
                  }}>
                    <span style={{ fontWeight: 700, minWidth: 16 }}>{"ABCD"[idx]})</span>
                    <span>{m.question?.[key]}</span>
                    {idx === m.question?.correctOpt && <span style={{ marginLeft: "auto", fontWeight: 700 }}>✓</span>}
                  </div>
                ))}
              </div>

              {/* Show/Hide Explanation */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setRevealed(r => ({ ...r, [i]: !r[i] }))}>
                  {revealed[i] ? "Hide" : "👁 Show"} Explanation
                </button>
                <button className="btn btn-purple btn-sm" onClick={() => askAiMentor(i, m.question?.id)} disabled={aiLoading[i]}>
                  {aiLoading[i] ? "Thinking..." : "🤖 Still confused? Ask AI Mentor"}
                </button>
              </div>
              {revealed[i] && (
                <div style={{ marginTop: 10, background: "var(--blue-light)", borderLeft: "3px solid var(--blue-mid)", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>
                  {m.question?.explanation}
                </div>
              )}
              {aiExplanations[i] && (
                <div style={{ marginTop: 10, background: "var(--purple-light)", borderLeft: "3px solid var(--purple)", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>
                  <strong style={{ color: "var(--purple)" }}>🤖 AI Mentor: </strong>{aiExplanations[i]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
          <button className="btn btn-outline btn-sm" disabled={filters.page <= 1} onClick={() => setFilter("page", filters.page - 1)}>← Prev</button>
          <span style={{ padding: "6px 14px", fontSize: 13, color: "var(--text2)" }}>Page {filters.page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={filters.page >= pages} onClick={() => setFilter("page", filters.page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
