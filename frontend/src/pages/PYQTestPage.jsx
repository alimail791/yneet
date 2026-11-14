import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";

// /pyq/:year/test?subject=Biology — attempt a NEET year's paper (one subject or
// all) as a timed test, NEET-style: 200 minutes for 180 questions, +4 / −1.
// Progress is kept in localStorage so closing the app mid-test doesn't lose it.
// On submit every answered question is recorded through /practice/solve, so it
// feeds the student's stats and Mistakes like normal practice.
const L = ["A", "B", "C", "D"];
const SECONDS_PER_Q = (200 * 60) / 180;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
const subjColor = (s) => (s === "Biology" ? "var(--green)" : s === "Physics" ? "var(--blue)" : "var(--amber)");

export default function PYQTestPage() {
  const { year } = useParams();
  const [params] = useSearchParams();
  const subject = ["Physics", "Chemistry", "Biology"].includes(params.get("subject")) ? params.get("subject") : "";
  const navigate = useNavigate();
  const KEY = `yneet_pyqtest_${year}_${subject || "all"}`;

  const [questions, setQuestions] = useState(null);
  const [state, setState] = useState(null); // { answers: {id: idx}, marked: {id: true}, i, endsAt, submitted }
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reviewFilter, setReviewFilter] = useState("wrong");

  // Load the paper (and any saved progress).
  useEffect(() => {
    const q = new URLSearchParams({ isPYQ: "true", pyqYear: year, limit: "250", page: "1" });
    if (subject) q.set("subject", subject);
    api.get(`/practice/questions?${q}`)
      .then((r) => {
        const qs = (r.data.questions || []).sort((a, b) => ["Physics", "Chemistry", "Biology"].indexOf(a.subject) - ["Physics", "Chemistry", "Biology"].indexOf(b.subject));
        setQuestions(qs);
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* ignore */ }
        if (saved && saved.ids?.length === qs.length) setState(saved);
      })
      .catch(() => setQuestions([]));
  }, [year, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state, KEY]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const durationSec = questions ? Math.round(questions.length * SECONDS_PER_Q) : 0;
  const left = state && !state.submitted ? Math.max(0, (state.endsAt - now) / 1000) : 0;

  const start = () => setState({ ids: questions.map((q) => q.id), answers: {}, marked: {}, visited: { [questions[0].id]: true }, i: 0, startedAt: Date.now(), endsAt: Date.now() + durationSec * 1000, submitted: false });
  const submit = () => setState((s) => (s && !s.submitted ? { ...s, submitted: true, submittedAt: Date.now() } : s));

  // Time's up → submit.
  useEffect(() => { if (state && !state.submitted && left <= 0) submit(); }, [left, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => {
    if (!state?.submitted || !questions) return null;
    let correct = 0, wrong = 0;
    const byChapter = {};
    for (const q of questions) {
      const a = state.answers[q.id];
      const c = (byChapter[`${q.subject}|${q.chapter}`] ||= { subject: q.subject, chapter: q.chapter, total: 0, correct: 0, wrong: 0 });
      c.total++;
      if (a === undefined) continue;
      if (a === q.correctOpt) { correct++; c.correct++; } else { wrong++; c.wrong++; }
    }
    const chapters = Object.values(byChapter).map((c) => ({ ...c, lost: (c.total - c.correct) * 4 + c.wrong })).sort((a, b) => b.lost - a.lost);
    return { correct, wrong, skipped: questions.length - correct - wrong, score: correct * 4 - wrong, max: questions.length * 4, chapters, timeUsed: Math.min(durationSec, ((state.submittedAt || Date.now()) - state.startedAt) / 1000) };
  }, [state, questions, durationSec]);

  // Record answers (feeds stats and Mistakes). Each answer that reaches the
  // server is remembered in state.sent, so a weak connection only delays it:
  // the rest are retried every 10 s, when the phone comes back online, and the
  // next time this page is opened. "Saved" shows only when every answer is in.
  const sending = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sendAnswers = async () => {
    const state = stateRef.current;
    if (sending.current || !state?.submitted || state.recorded || !questions) return;
    sending.current = true;
    const sent = { ...(state.sent || {}) };
    let failed = false;
    for (const q of questions) {
      const a = state.answers[q.id];
      if (a === undefined || sent[q.id]) continue;
      try {
        await api.post("/practice/solve", { questionId: q.id, correct: a === q.correctOpt });
        sent[q.id] = true;
      } catch (err) {
        if (err?.response?.status >= 400 && err?.response?.status < 500) { sent[q.id] = true; continue; } // rejected, retrying won't help
        failed = true;
        break;
      }
    }
    setState((s) => ({ ...s, sent, recorded: !failed }));
    sending.current = false;
  };
  useEffect(() => {
    if (!result || state.recorded) return;
    sendAnswers();
    const t = setInterval(sendAnswers, 10000);
    window.addEventListener("online", sendAnswers);
    return () => { clearInterval(t); window.removeEventListener("online", sendAnswers); };
  }, [result, state?.recorded]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = `NEET ${year}${subject ? ` ${subject}` : " full paper"}`;
  if (questions === null) return <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div>;
  if (!questions.length) return (
    <div className="card text-center" style={{ padding: 40 }}>
      <p style={{ color: "var(--text2)" }}>No questions loaded for {title} yet.</p>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/pyq/${year}`)}>← Back</button>
    </div>
  );

  // ── Start screen ──
  if (!state) return (
    <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section-title">⏱ {title} — timed test</div>
      <p style={{ color: "var(--text2)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
        {questions.length} questions · {Math.round(durationSec / 60)} minutes (NEET pace) · +4 for a correct answer, −1 for a wrong one, 0 if you skip.
        Your progress is saved if you close the app; the test submits itself when time runs out.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn btn-blue" onClick={start}>Start test</button>
        <button className="btn btn-outline" onClick={() => navigate(`/pyq/${year}`)}>← Back to paper</button>
      </div>
    </div>
  );

  // ── Result ──
  if (result) {
    const shown = questions.filter((q) => {
      const a = state.answers[q.id];
      return reviewFilter === "all" ? true : reviewFilter === "skipped" ? a === undefined : a !== undefined && a !== q.correctOpt;
    });
    return (
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">📊 {title} — your result</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <Stat label="Score" value={`${result.score} / ${result.max}`} big />
            <Stat label="Correct" value={result.correct} color="var(--green)" />
            <Stat label="Wrong" value={result.wrong} color="var(--red)" />
            <Stat label="Skipped" value={result.skipped} />
            <Stat label="Accuracy" value={`${result.correct + result.wrong ? Math.round((result.correct / (result.correct + result.wrong)) * 100) : 0}%`} />
            <Stat label="Time used" value={fmt(result.timeUsed)} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 10 }}>{state.recorded ? "✓ Saved to your stats and Mistakes." : `Saving your answers… (${Object.keys(state.sent || {}).length}/${Object.keys(state.answers).length}) — no internet? It will finish when you're back online.`}</p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Where you lost marks</div>
          {result.chapters.filter((c) => c.lost > 0).slice(0, 8).map((c) => (
            <div key={c.subject + c.chapter} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--gray2)", fontSize: 13 }}>
              <span><span style={{ color: subjColor(c.subject), fontWeight: 700 }}>●</span> {c.chapter}</span>
              <span style={{ color: "var(--text2)", whiteSpace: "nowrap" }}>{c.correct}/{c.total} right · −{c.lost} marks</span>
            </div>
          ))}
          {result.chapters.every((c) => c.lost === 0) && <p style={{ fontSize: 13, color: "var(--text2)" }}>Full marks — nothing lost!</p>}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[["wrong", "Wrong"], ["skipped", "Skipped"], ["all", "All"]].map(([k, l]) => (
            <span key={k} onClick={() => setReviewFilter(k)} className="chip" style={{ cursor: "pointer", fontWeight: 700, background: reviewFilter === k ? "var(--blue-light)" : "var(--gray2)", color: reviewFilter === k ? "var(--blue)" : "var(--text2)" }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((q) => {
            const a = state.answers[q.id];
            const n = questions.indexOf(q) + 1;
            return (
              <div key={q.id} className="card" style={{ borderLeft: `3px solid ${subjColor(q.subject)}` }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Q{n} · {q.subject} · {q.chapter}</div>
                <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-line" }}>{q.questionText}</p>
                {[q.optionA, q.optionB, q.optionC, q.optionD].map((o, k) => (
                  <div key={k} style={{ display: "flex", gap: 8, padding: "7px 10px", marginBottom: 6, borderRadius: 8, fontSize: 13,
                    background: k === q.correctOpt ? "var(--green-light)" : k === a ? "var(--red-light, #fdecec)" : "var(--gray2)",
                    border: `1.5px solid ${k === q.correctOpt ? "var(--green)" : k === a ? "var(--red)" : "var(--gray3)"}` }}>
                    <b>{L[k]})</b> <span>{o}</span>
                    {k === a && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700 }}>Your answer</span>}
                  </div>
                ))}
                {q.explanation && <div style={{ background: "var(--green-light)", borderLeft: "3px solid var(--green)", padding: "8px 12px", borderRadius: "0 8px 8px 0", fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>{q.explanation}</div>}
              </div>
            );
          })}
          {!shown.length && <p style={{ color: "var(--text2)", fontSize: 13 }}>Nothing here.</p>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn btn-blue" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setState(null); }}>Retake</button>
          <button className="btn btn-outline" onClick={() => navigate("/pyq")}>All years</button>
        </div>
      </div>
    );
  }

  // ── Test in progress ──
  const q = questions[state.i];
  const answered = Object.keys(state.answers).length;
  const go = (i) => setState((s) => { const n = Math.max(0, Math.min(questions.length - 1, i)); window.scrollTo({ top: 0 }); return { ...s, i: n, visited: { ...(s.visited || {}), [questions[n].id]: true } }; });
  const pick = (k) => setState((s) => {
    const answers = { ...s.answers };
    if (answers[q.id] === k) delete answers[q.id]; else answers[q.id] = k; // tap again to clear
    return { ...s, answers };
  });
  const toggleMark = () => setState((s) => ({ ...s, marked: { ...s.marked, [q.id]: !s.marked[q.id] } }));

  return (
    <div>
      <div className="card" style={{ position: "sticky", top: "var(--nav-h)", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
        <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: left < 300 ? "var(--red)" : "var(--text)" }}>⏱ {fmt(left)}</div>
        <button className="btn btn-red btn-sm" onClick={() => setConfirm(true)}>Submit</button>
      </div>

      <div className="card" style={{ borderLeft: `3px solid ${subjColor(q.subject)}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
          <span>Q{state.i + 1} of {questions.length} · {q.subject}</span>
          <span>{answered} answered</span>
        </div>
        <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-line" }}>{q.questionText}</p>
        {[q.optionA, q.optionB, q.optionC, q.optionD].map((o, k) => {
          const on = state.answers[q.id] === k;
          return (
            <div key={k} onClick={() => pick(k)} style={{ cursor: "pointer", display: "flex", gap: 10, padding: "12px 14px", marginBottom: 8, borderRadius: 10, fontSize: 14,
              background: on ? "var(--blue-light)" : "var(--gray2)", border: `2px solid ${on ? "var(--blue)" : "var(--gray3)"}`, fontWeight: on ? 700 : 500 }}>
              <b>{L[k]})</b> <span>{o}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn btn-outline" disabled={state.i === 0} onClick={() => go(state.i - 1)}>← Prev</button>
          <button className="btn btn-outline btn-sm" onClick={toggleMark}>{state.marked[q.id] ? "★ Marked" : "☆ Mark for review"}</button>
          <button className="btn btn-blue" style={{ marginLeft: "auto" }} disabled={state.i === questions.length - 1} onClick={() => go(state.i + 1)}>Next →</button>
        </div>
      </div>

      <div className="card cbt" style={{ marginTop: 12 }}>
        <div className="cbt-legend" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[["", "Not visited"], ["not-answered", "Not answered"], ["answered", "Answered"], ["marked", "Marked for review"], ["answered-marked", "Answered & marked"]].map(([c, l]) => (
            <span key={l}><i className={`q-num q-legend ${c}`} />{l}</span>
          ))}
        </div>
        <div className="q-nav cbt-qnav">
          {questions.map((x, i) => {
            const ans = state.answers[x.id] !== undefined;
            const mk = state.marked[x.id];
            const seen = state.visited ? state.visited[x.id] : true;
            const cls = ans && mk ? "answered-marked" : mk ? "marked" : ans ? "answered" : seen ? "not-answered" : "";
            return <button key={x.id} type="button" className={`q-num ${cls} ${i === state.i ? "current" : ""}`} onClick={() => go(i)} aria-label={`Question ${i + 1}`}>{i + 1}</button>;
          })}
        </div>
      </div>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }} onClick={() => setConfirm(false)}>
          <div className="card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Submit the test?</div>
            <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 6 }}>{answered} of {questions.length} answered{questions.length - answered ? `, ${questions.length - answered} left blank` : ""}. Time left: {fmt(left)}.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-red" onClick={() => { setConfirm(false); submit(); }}>Submit</button>
              <button className="btn btn-outline" onClick={() => setConfirm(false)}>Keep going</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, big }) {
  return (
    <div style={{ background: "var(--gray2)", borderRadius: 10, padding: "10px 14px", minWidth: 90 }}>
      <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 800, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}
