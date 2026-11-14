import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

// NEET-style computer-based test screen.
//
// - Always (re)loads the attempt from the server (GET /mock/:id/resume): the
//   same question order, the answers already saved and the real time left. A
//   page refresh, the app being closed or the Continue button never resets
//   the clock or loses answers.
// - The timer counts down to a fixed deadline (not tick by tick), so it stays
//   right even when the phone sleeps or the tab is in the background.
// - Every answer is saved at once. A save that fails (weak signal) is queued,
//   kept on the phone and retried; Submit waits for the queue.
// - Palette in the five NTA colours; summary screen before submitting.
// - Time spent on each question is recorded (for the time analysis).

const STATUS = {
  notVisited: { label: "Not visited", cls: "" },
  notAnswered: { label: "Not answered", cls: "not-answered" },
  answered: { label: "Answered", cls: "answered" },
  marked: { label: "Marked for review", cls: "marked" },
  answeredMarked: { label: "Answered & marked (will be evaluated)", cls: "answered-marked" },
};

const isAnswered = (r) => r && r.selected !== undefined && r.selected !== null;

function statusOf(r, visited) {
  if (isAnswered(r) && r.marked) return "answeredMarked";
  if (r?.marked) return "marked";
  if (isAnswered(r)) return "answered";
  return visited ? "notAnswered" : "notVisited";
}

const pad = (n) => String(n).padStart(2, "0");
const fmt = (s) => `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export default function MockTestPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const storeKey = `yneet_mock_${attemptId}`;

  const [questions, setQuestions] = useState([]);
  const [test, setTest] = useState({});
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState({}); // questionId -> { selected, marked, timeSec }
  const [visited, setVisited] = useState(() => new Set());
  const [secsLeft, setSecsLeft] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const deadlineRef = useRef(0);
  const pendingRef = useRef({}); // questionId -> payload still to save
  const responsesRef = useRef({});
  const enteredAtRef = useRef(Date.now());
  const submittedRef = useRef(false);
  responsesRef.current = responses;

  const visitedRef = useRef(visited);
  visitedRef.current = visited;
  const currentRef = useRef(0);
  currentRef.current = current;

  // ---- local backup of unsaved answers (survives refresh / app kill) ----
  const persistLocal = useCallback(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ pending: pendingRef.current, visited: [...visitedRef.current], current: currentRef.current }));
    } catch { /* storage full or blocked */ }
  }, [storeKey]);
  useEffect(() => { if (questions.length) persistLocal(); }, [visited, current, questions.length, persistLocal]);

  // ---- load (or resume) the attempt ----
  useEffect(() => {
    let cancelled = false;
    api.get(`/mock/${attemptId}/resume`).then(({ data }) => {
      if (cancelled) return;
      if (data.submitted) { navigate(`/mock/${attemptId}/analysis`, { replace: true }); return; }
      const saved = {};
      for (const r of data.attempt?.responses || []) saved[r.questionId] = { selected: r.selected, marked: r.isMarked, timeSec: r.timeSec || 0 };
      let local = {};
      try { local = JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { /* ignore */ }
      // Answers that never reached the server win over the server copy.
      const pending = local.pending || {};
      for (const [qid, p] of Object.entries(pending)) saved[qid] = { selected: p.selected, marked: p.isMarked, timeSec: p.timeSec || 0 };
      pendingRef.current = pending;
      setPendingCount(Object.keys(pending).length);
      const v = new Set(local.visited || []);
      Object.keys(saved).forEach((qid) => v.add(qid));
      if (data.questions[0]) v.add(data.questions[0].id);
      setVisited(v);
      setResponses(saved);
      setQuestions(data.questions);
      // Back on the question they were on before the refresh.
      if (Number.isInteger(local.current) && local.current > 0 && local.current < data.questions.length) setCurrent(local.current);
      setTest(data.test);
      deadlineRef.current = Date.now() + data.secsLeft * 1000;
      setSecsLeft(data.secsLeft);
      enteredAtRef.current = Date.now();
    }).catch((err) => {
      if (!cancelled) setLoadError(err?.response?.data?.message || "Couldn't load the test. Check your internet and try again.");
    });
    return () => { cancelled = true; };
  }, [attemptId, navigate, storeKey]);

  // ---- saving ----
  const flushPending = useCallback(async () => {
    const entries = Object.entries(pendingRef.current);
    for (const [qid, payload] of entries) {
      try {
        await api.post(`/mock/${attemptId}/response`, payload);
        if (pendingRef.current[qid] === payload) delete pendingRef.current[qid];
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === "submitted" || code === "time_up") { delete pendingRef.current[qid]; continue; }
        if (err?.response?.status === 403 || err?.response?.status === 404) { delete pendingRef.current[qid]; continue; }
        break; // offline / server down: keep the rest queued, retry later
      }
    }
    setPendingCount(Object.keys(pendingRef.current).length);
    persistLocal();
    return Object.keys(pendingRef.current).length === 0;
  }, [attemptId, persistLocal]);

  const save = useCallback((qid, next) => {
    pendingRef.current[qid] = { questionId: qid, selected: next.selected ?? null, isMarked: !!next.marked, timeSec: Math.round(next.timeSec || 0) };
    setPendingCount(Object.keys(pendingRef.current).length);
    persistLocal();
    flushPending();
  }, [flushPending, persistLocal]);

  // Retry queued saves every 5 s and as soon as the connection comes back.
  useEffect(() => {
    const id = setInterval(() => { if (Object.keys(pendingRef.current).length) flushPending(); }, 5000);
    const online = () => flushPending();
    window.addEventListener("online", online);
    return () => { clearInterval(id); window.removeEventListener("online", online); };
  }, [flushPending]);

  const update = useCallback((qid, patch) => {
    const next = { ...responsesRef.current[qid], ...patch };
    responsesRef.current = { ...responsesRef.current, [qid]: next };
    setResponses(responsesRef.current);
    save(qid, next);
  }, [save]);

  // Add the time spent on the current question before leaving it.
  const recordTime = useCallback(() => {
    const q = questions[current];
    if (!q) return;
    const spent = (Date.now() - enteredAtRef.current) / 1000;
    enteredAtRef.current = Date.now();
    if (spent < 1) return;
    const prev = responsesRef.current[q.id] || {};
    update(q.id, { timeSec: (prev.timeSec || 0) + spent });
  }, [questions, current, update]);

  const goTo = useCallback((i) => {
    if (i < 0 || i >= questions.length || i === current) return;
    recordTime();
    setCurrent(i);
    setVisited((v) => { const n = new Set(v); n.add(questions[i].id); return n; });
    setShowPalette(false);
    window.scrollTo({ top: 0 });
  }, [questions, current, recordTime]);

  // ---- submit ----
  const submitTest = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setShowSummary(false);
    recordTime();
    // Give queued answers a few tries to reach the server first.
    for (let i = 0; i < 4 && !(await flushPending()); i++) await new Promise((r) => setTimeout(r, 1500));
    if (Object.keys(pendingRef.current).length && !auto) {
      const go = window.confirm(`${Object.keys(pendingRef.current).length} answer(s) haven't reached the server yet (no internet?). Submit anyway? Those answers will not count.`);
      if (!go) { submittedRef.current = false; setSubmitting(false); return; }
    }
    const timeTaken = (test?.durationMin || 200) * 60 - Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
    try {
      await api.post(`/mock/${attemptId}/submit`, { timeTaken });
      try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
      navigate(`/mock/${attemptId}/analysis`, { replace: true });
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      alert(`Submission failed: ${err?.response?.data?.message || "check your internet and tap Submit again."}`);
    }
  }, [attemptId, test, navigate, flushPending, recordTime, storeKey]);

  // ---- timer: counts down to a fixed deadline ----
  useEffect(() => {
    if (secsLeft === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSecsLeft(left);
      if (left === 0) { clearInterval(id); submitTest(true); }
    }, 1000);
    return () => clearInterval(id);
  }, [secsLeft === null, submitTest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before an accidental refresh/back/close. (Answers are safe either way.)
  useEffect(() => {
    const handler = (e) => { if (submittedRef.current) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (loadError) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <p style={{ marginBottom: 14 }}>{loadError}</p>
        <button className="btn btn-blue" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }
  if (!questions.length || secsLeft === null) return <div className="loading-screen"><div className="spinner"></div><p>Loading test...</p></div>;

  const q = questions[current];
  const resp = responses[q.id];
  const counts = { notVisited: 0, notAnswered: 0, answered: 0, marked: 0, answeredMarked: 0 };
  questions.forEach((x) => { counts[statusOf(responses[x.id], visited.has(x.id))]++; });
  const answeredTotal = counts.answered + counts.answeredMarked;
  const subjectColor = { Physics: "var(--blue)", Chemistry: "var(--amber)", Biology: "var(--green)" };
  const headerSubjectColor = { Physics: "#bfdbfe", Chemistry: "#fde68a", Biology: "#bbf7d0" };
  const isLast = current === questions.length - 1;

  const palette = (
    <div className="cbt-palette">
      <div className="cbt-legend">
        {Object.entries(STATUS).map(([k, s]) => (
          <span key={k}><i className={`q-num q-legend ${s.cls}`}>{counts[k]}</i>{s.label}</span>
        ))}
      </div>
      {["Physics", "Chemistry", "Biology"].filter((sub) => questions.some((x) => x.subject === sub)).map((sub) => (
        <div key={sub}>
          <div className="cbt-palette-sub" style={{ color: subjectColor[sub] }}>{sub}</div>
          <div className="q-nav cbt-qnav">
            {questions.map((x, i) => x.subject !== sub ? null : (
              <button key={x.id} type="button" aria-label={`Question ${i + 1}: ${STATUS[statusOf(responses[x.id], visited.has(x.id))].label}`}
                className={`q-num ${STATUS[statusOf(responses[x.id], visited.has(x.id))].cls} ${i === current ? "current" : ""}`}
                onClick={() => goTo(i)}>{i + 1}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="cbt cbt-page">
      {/* Header: stays on screen while scrolling */}
      <div className="test-header cbt-header">
        <div style={{ minWidth: 0 }}>
          <div className="cbt-title">{test?.title || "Mock Test"}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Q.{current + 1}/{questions.length} · <span style={{ color: headerSubjectColor[q.subject] || "#fff" }}>{q.subject}</span>
          </div>
        </div>
        <div className="test-timer cbt-timer" aria-live="off" aria-label="Time left" style={{ color: secsLeft < 600 ? "#fca5a5" : "#fff" }}>{fmt(secsLeft)}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="cbt-head-btn cbt-palette-toggle" onClick={() => setShowPalette(true)}>☰ <span>{answeredTotal}/{questions.length}</span></button>
          <button type="button" className="cbt-head-btn" onClick={() => { recordTime(); setShowSummary(true); }} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
      <div className={`cbt-save ${pendingCount ? "warn" : ""}`}>
        {pendingCount ? `⚠ ${pendingCount} answer${pendingCount === 1 ? "" : "s"} waiting for internet — kept on this phone, will save automatically` : "✓ All answers saved"}
      </div>

      <div className="cbt-body">
        {/* Question */}
        <div className="cbt-question">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`chip ${q.subject === "Biology" ? "chip-green" : q.subject === "Physics" ? "chip-blue" : "chip-amber"}`}>{q.subject}</span>
            <span style={{ fontSize: 12, color: "var(--text2)" }}>{q.chapter}{q.topic ? ` · ${q.topic}` : ""}</span>
            {q.isPYQ && <span className="pyq-badge">PYQ {q.pyqYear}</span>}
          </div>
          <p className="quiz-q">{q.questionText}</p>
          <div role="radiogroup" aria-label={`Question ${current + 1} options`}>
            {["optionA", "optionB", "optionC", "optionD"].map((key, idx) => (
              <button type="button" role="radio" aria-checked={resp?.selected === idx} key={key}
                className={`quiz-opt cbt-opt ${resp?.selected === idx ? "selected" : ""}`}
                onClick={() => update(q.id, { selected: idx })}>
                <span className="opt-key">{"ABCD"[idx]}</span><span>{q[key]}</span>
              </button>
            ))}
          </div>
          <div className="cbt-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => update(q.id, { selected: null })} disabled={!isAnswered(resp)}>Clear response</button>
            <button type="button" className={`btn btn-sm ${resp?.marked ? "btn-purple" : "btn-outline"}`}
              onClick={() => { update(q.id, { marked: !resp?.marked }); if (!resp?.marked && !isLast) goTo(current + 1); }}>
              🔖 {resp?.marked ? "Unmark" : isLast ? "Mark for review" : "Mark & next"}
            </button>
          </div>
        </div>

        {/* Palette: side panel on wide screens, slide-up sheet on phones */}
        <aside className={`cbt-side ${showPalette ? "open" : ""}`} aria-label="Question palette">
          <div className="cbt-sheet-head">
            <b>Questions</b>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPalette(false)}>Close</button>
          </div>
          {palette}
        </aside>
        {showPalette && <div className="cbt-backdrop" onClick={() => setShowPalette(false)} />}
      </div>

      {/* Bottom bar: Prev / Save & Next, always within thumb reach */}
      <div className="cbt-bottom">
        <button type="button" className="btn btn-outline" onClick={() => goTo(current - 1)} disabled={current === 0}>← Prev</button>
        {isLast ? (
          <button type="button" className="btn btn-green" onClick={() => { recordTime(); setShowSummary(true); }} disabled={submitting}>Review & Submit ✓</button>
        ) : (
          <button type="button" className="btn btn-blue" onClick={() => goTo(current + 1)}>Save & Next →</button>
        )}
      </div>

      {/* Submit summary */}
      {showSummary && (
        <div className="cbt-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cbt-sum-title">
          <div className="cbt-modal">
            <h3 id="cbt-sum-title" style={{ marginTop: 0 }}>Submit test?</h3>
            <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 0 }}>Time left: {fmt(secsLeft)}. You can't change answers after submitting.</p>
            <table className="cbt-sum">
              <tbody>
                {Object.entries(STATUS).map(([k, s]) => (
                  <tr key={k}><td><i className={`q-num q-legend ${s.cls}`}>{counts[k]}</i></td><td>{s.label}</td></tr>
                ))}
              </tbody>
            </table>
            {pendingCount > 0 && <p style={{ color: "var(--red)", fontSize: 13 }}>{pendingCount} answer(s) still waiting for internet. We'll try to save them before submitting.</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn btn-outline" onClick={() => { enteredAtRef.current = Date.now(); setShowSummary(false); }}>Back to test</button>
              <button type="button" className="btn btn-green" onClick={() => submitTest(false)} disabled={submitting}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
