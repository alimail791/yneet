import { useState, useEffect } from "react";
import api from "../lib/api";

// A dedicated Previous Year Questions page — separate from the general
// Practice page's "PYQ Only" filter toggle, so students can browse past
// NEET papers by year directly from the main menu instead of hunting for
// a filter. Pulls from the same Question records (isPYQ + pyqYear), just a
// different entry point focused on year-wise browsing.
export default function PYQPage() {
  const [years, setYears] = useState([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null);
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    api.get("/practice/pyq-years")
      .then((r) => {
        const ys = r.data.years || [];
        setYears(ys);
        if (ys.length > 0) setSelectedYear(ys[0].year);
      })
      .catch(() => {})
      .finally(() => setYearsLoading(false));
  }, []);

  const fetchQuestions = (year, subj, pg = 1) => {
    if (!year) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("isPYQ", "true");
    params.set("pyqYear", year);
    if (subj) params.set("subject", subj);
    params.set("page", pg);
    params.set("limit", 20);
    api.get(`/practice/questions?${params}`)
      .then((r) => {
        setQuestions(r.data.questions || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
        setPage(pg);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedYear) fetchQuestions(selectedYear, subject, 1);
  }, [selectedYear, subject]);

  const toggleReveal = (id) => setRevealed((r) => ({ ...r, [id]: !r[id] }));

  const markSolved = async (q, correct) => {
    await api.post("/practice/solve", { questionId: q.id, correct });
    setQuestions((qs) => qs.map((item) => (item.id === q.id ? { ...item, userStat: { solved: true, correct } } : item)));
  };

  if (yearsLoading) {
    return <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="section-header mb-4">
        <div>
          <div className="section-title">📅 Previous Year Questions</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Actual NEET exam papers, organized by year</p>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <h3>No previous year papers loaded yet</h3>
          <p style={{ color: "var(--text2)", marginTop: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your admin hasn't added any past NEET papers yet — once a question is tagged "Is PYQ" with a year
            in the admin Question Bank, it'll show up here automatically, grouped by year.
          </p>
        </div>
      ) : (
        <>
          {/* Year tabs */}
          <div className="chip-row mb-3" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {years.map((y) => (
              <span
                key={y.year}
                onClick={() => setSelectedYear(y.year)}
                style={{
                  cursor: "pointer", padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                  background: selectedYear === y.year ? "linear-gradient(135deg,var(--blue-mid),var(--purple))" : "var(--gray2)",
                  color: selectedYear === y.year ? "#fff" : "var(--text2)",
                }}
              >
                NEET {y.year} <span style={{ opacity: 0.75, fontWeight: 500 }}>({y.total})</span>
              </span>
            ))}
          </div>

          {/* Subject filter */}
          <div className="chip-row mb-5" style={{ display: "flex", gap: 8 }}>
            {["", "Physics", "Chemistry", "Biology"].map((s) => (
              <span
                key={s || "all"}
                onClick={() => setSubject(s)}
                className={`chip ${s === "Biology" ? "chip-green" : s === "Physics" ? "chip-blue" : s === "Chemistry" ? "chip-amber" : ""}`}
                style={{ cursor: "pointer", background: subject === s ? undefined : "var(--gray2)", opacity: subject === s ? 1 : 0.6, fontWeight: 700 }}
              >
                {s || "All Subjects"}
              </span>
            ))}
            <div style={{ fontSize: 13, color: "var(--text3)", alignSelf: "center", marginLeft: "auto" }}>{total} questions</div>
          </div>

          {/* Questions */}
          {loading ? (
            <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div>
          ) : questions.length === 0 ? (
            <div className="card text-center" style={{ padding: 40 }}>
              <p style={{ color: "var(--text2)" }}>No {subject || ""} questions loaded for NEET {selectedYear} yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {questions.map((q, i) => (
                <div key={q.id} className="card" style={{ borderLeft: `3px solid ${q.subject === "Biology" ? "var(--green)" : q.subject === "Physics" ? "var(--blue)" : "var(--amber)"}` }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>Q{(page - 1) * 20 + i + 1}</span>
                    <span className={`chip ${q.subject === "Biology" ? "chip-green" : q.subject === "Physics" ? "chip-blue" : "chip-amber"}`}>{q.subject}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>{q.chapter} · {q.topic}</span>
                    <span className="pyq-badge">NEET {q.pyqYear}</span>
                    {q.userStat?.solved && <span className="solved-badge">{q.userStat.correct ? "✓ Correct" : "✗ Wrong"}</span>}
                  </div>

                  <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 12 }}>{q.questionText}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {["A", "B", "C", "D"].map((key, idx) => (
                      <div key={key} style={{ display: "flex", gap: 8, padding: "8px 12px", background: revealed[q.id] && idx === q.correctOpt ? "var(--green-light)" : "var(--gray2)", border: `1.5px solid ${revealed[q.id] && idx === q.correctOpt ? "var(--green)" : "var(--gray3)"}`, borderRadius: 8, fontSize: 13, color: revealed[q.id] && idx === q.correctOpt ? "var(--green)" : "var(--text)" }}>
                        <span style={{ fontWeight: 700, minWidth: 18 }}>{key})</span>
                        <span>{[q.optionA, q.optionB, q.optionC, q.optionD][idx]}</span>
                      </div>
                    ))}
                  </div>

                  {!revealed[q.id] ? (
                    <button className="btn btn-outline btn-sm" onClick={() => toggleReveal(q.id)}>👁 Show Answer</button>
                  ) : (
                    <div style={{ background: "var(--green-light)", borderLeft: "3px solid var(--green)", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
                      <strong style={{ color: "var(--green)" }}>✅ Answer: {["A", "B", "C", "D"][q.correctOpt]}) {[q.optionA, q.optionB, q.optionC, q.optionD][q.correctOpt]}</strong>
                      <br />{q.explanation}
                    </div>
                  )}

                  {!q.userStat?.solved && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-green btn-sm" onClick={() => markSolved(q, true)}>✓ Got it right</button>
                      <button className="btn btn-red btn-sm" onClick={() => markSolved(q, false)}>✗ Got it wrong</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => fetchQuestions(selectedYear, subject, page - 1)}>← Prev</button>
              <span style={{ padding: "6px 14px", fontSize: 13, color: "var(--text2)" }}>Page {page} of {pages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => fetchQuestions(selectedYear, subject, page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
