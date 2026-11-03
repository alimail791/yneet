// 60-Second Sprint: 5 quick questions, 60 seconds, one ranked try a day.
// The clock runs on the server (see backend routes/sprint.js); this page only
// shows it. After the ranked try, students can review answers, see the top 10,
// share their score on WhatsApp and replay the same questions for practice.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

const SHARE_LINK = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "") + "/neet-trial";
const secs = (ms) => Math.max(0, Math.round(ms / 1000));
const ink = "#3b2fc9";

export default function SprintPage() {
  const [phase, setPhase] = useState("loading"); // loading | intro | playing | result | practice | error
  const [status, setStatus] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(null); // { i, picks, start, done }
  const submitting = useRef(false);

  useEffect(() => {
    api.get("/sprint/status").then((r) => {
      setStatus(r.data);
      if (r.data.played) loadResult(); else setPhase("intro");
    }).catch(() => { setError("Couldn't load the Sprint. Please try again."); setPhase("error"); });
  }, []);

  // Countdown tick while playing (ranked or practice).
  useEffect(() => {
    if (phase !== "playing" && phase !== "practice") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const left = Math.max(0, deadline - now);

  // Time's up → submit whatever is answered.
  useEffect(() => {
    if (phase === "playing" && left <= 0 && deadline) submit(answers);
    if (phase === "practice" && left <= 0 && deadline && practice && !practice.done) setPractice({ ...practice, done: true });
  }, [left, phase]);

  const loadBoard = () => api.get("/sprint/leaderboard").then((r) => setBoard(r.data)).catch(() => {});

  const loadResult = async () => {
    // /start returns the stored result when today's try is already done.
    try {
      const { data } = await api.post("/sprint/start");
      setResult(data); setPhase("result"); loadBoard();
    } catch {
      setError("Couldn't load today's result. Please try again."); setPhase("error");
    }
  };

  const start = async () => {
    setPhase("loading");
    try {
      const { data } = await api.post("/sprint/start");
      if (data.played) { setResult(data); setPhase("result"); loadBoard(); return; }
      setQuestions(data.questions);
      setAnswers([]);
      setDeadline(Date.now() + data.remainingMs);
      setNow(Date.now());
      setPhase("playing");
      try { window.gtag?.("event", "sprint_start"); } catch { /* ignore */ }
    } catch (e) {
      setError(e?.response?.data?.message || "Couldn't start the Sprint. Please try again.");
      setPhase("error");
    }
  };

  const submit = async (picks) => {
    if (submitting.current) return;
    submitting.current = true;
    setPhase("loading");
    try {
      const { data } = await api.post("/sprint/submit", { answers: picks });
      setResult(data); setPhase("result"); loadBoard();
      try { window.gtag?.("event", "sprint_finish", { score: data.score }); } catch { /* ignore */ }
    } catch {
      setError("Couldn't save your Sprint. Check your internet and reopen this page.");
      setPhase("error");
    }
    submitting.current = false;
  };

  const pick = (k) => {
    const next = answers.concat([k]);
    setAnswers(next);
    if (next.length >= questions.length) submit(next);
  };

  const startPractice = () => {
    setPractice({ i: 0, picks: [], done: false });
    setDeadline(Date.now() + 60000);
    setNow(Date.now());
    setPhase("practice");
  };

  // ── Screens ──
  const header = (title, sub, showClock) => (
    <div style={{ background: ink, color: "#fff", padding: "20px 18px 18px", borderRadius: "0 0 22px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <Link to="/" style={{ color: "#c7d2fe", fontSize: 13, fontWeight: 600 }}>← Home</Link>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{title}</div>
        </div>
        {showClock && (
          <div style={{ minWidth: 64, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, background: left <= 10000 ? "#f5a623" : "#fff", color: left <= 10000 ? "#1e1b4b" : ink }}>
            {secs(left)}s
          </div>
        )}
      </div>
      {showClock && (
        <div style={{ height: 8, borderRadius: 4, background: "#312e81", overflow: "hidden", marginTop: 12 }}>
          <div style={{ height: 8, borderRadius: 4, background: "#f5a623", width: `${(left / 60000) * 100}%`, transition: "width .25s linear" }} />
        </div>
      )}
      {sub && <p style={{ fontSize: 13, color: "#c7d2fe", marginTop: 10 }}>{sub}</p>}
    </div>
  );

  const wrap = (children) => (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 40 }}>{children}</div>
    </div>
  );

  const questionView = (q, idx, total, onPick, picks) => (
    <div style={{ padding: "20px 16px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>
        <span>Question {idx + 1} of {total}</span><span>{q.subject}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.4, minHeight: 80 }}>{q.text}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {q.options.map((o, k) => (
          <button key={k} onClick={() => onPick(k)}
            style={{ minHeight: 68, padding: "8px 10px", borderRadius: 16, border: "2px solid var(--gray3)", background: "#fff", fontSize: 16, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}>
            {o}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {Array.from({ length: total }).map((_, k) => (
          <span key={k} style={{ width: 12, height: 12, borderRadius: 6, background: k < picks.length ? "#94a3b8" : k === idx ? ink : "var(--gray3)" }} />
        ))}
      </div>
    </div>
  );

  if (phase === "loading") return wrap(<div className="loading-screen"><div className="spinner"></div></div>);

  if (phase === "error") return wrap(<>{header("60-Second Sprint")}<div className="card" style={{ margin: 16 }}><p>{error}</p><button className="btn btn-blue" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Try again</button></div></>);

  if (phase === "intro") return wrap(
    <>
      {header("60-Second Sprint", `${status?.group || "NEET"} · today's ranked round`)}
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <p style={{ fontSize: 17, fontWeight: 800 }}>How it works</p>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            5 quick questions, 60 seconds. Tap an answer and the next question appears; there's no going back.
            Your first try today counts for the ranking. More correct answers win; if it's a tie, the faster time wins.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
            <span style={{ background: "var(--blue-light)", color: ink, padding: "4px 10px", borderRadius: 10, fontWeight: 700 }}>{status?.players || 0} played today</span>
            {status?.streak > 0 && <span style={{ background: "var(--amber-light)", color: "#92400e", padding: "4px 10px", borderRadius: 10, fontWeight: 700 }}>{status.streak}-day sprint streak</span>}
          </div>
        </div>
        <button className="btn btn-blue" style={{ justifyContent: "center", height: 54, fontSize: 17, borderRadius: 27, background: ink }} onClick={start}>Start, the clock begins</button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>A new Sprint every day at midnight.</p>
      </div>
    </>
  );

  if (phase === "playing") {
    const idx = answers.length;
    const q = questions[Math.min(idx, questions.length - 1)];
    return wrap(<>{header("60-Second Sprint", null, true)}{q && questionView(q, idx, questions.length, pick, answers)}</>);
  }

  if (phase === "practice" && practice) {
    const qs = result.review;
    if (practice.done || practice.i >= qs.length) {
      const score = practice.picks.reduce((n, p, i) => n + (p === qs[i].answer ? 1 : 0), 0);
      return wrap(<>{header("Practice round")}<div style={{ padding: 16, display: "grid", gap: 12 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text2)" }}>Practice score (not ranked)</p>
          <p style={{ fontSize: 48, fontWeight: 800, color: ink }}>{score}/{qs.length}</p>
        </div>
        <button className="btn btn-outline" style={{ justifyContent: "center" }} onClick={() => setPhase("result")}>Back to today's result</button>
      </div></>);
    }
    const q = qs[practice.i];
    return wrap(<>{header("Practice round", "Not ranked. Same questions, new try.", true)}
      {questionView(q, practice.i, qs.length, (k) => setPractice({ ...practice, i: practice.i + 1, picks: practice.picks.concat([k]) }), practice.picks)}</>);
  }

  // Result
  const r = result;
  const shareText = `I scored ${r.score}/5 in ${secs(r.timeMs)} seconds in today's YNeet 60-Second Sprint${r.rank ? ` (rank #${r.rank} of ${r.players})` : ""}. Can you beat me? 🏁\n${SHARE_LINK}`;
  return wrap(
    <>
      {header("60-Second Sprint", `${r.group} · ${r.answered < 5 ? "Time ran out" : "Sprint complete"}`)}
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div className="card" style={{ textAlign: "center", display: "grid", gap: 6 }}>
          <p style={{ fontSize: 14, color: "var(--text2)", fontWeight: 700 }}>Today's score</p>
          <p style={{ fontSize: 60, fontWeight: 800, lineHeight: 1, color: ink }}>{r.score}/5</p>
          <p style={{ fontSize: 14, color: "var(--text2)" }}>{r.answered < 5 ? `Answered ${r.answered} of 5 before time ran out.` : `Finished in ${secs(r.timeMs)} seconds.`}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div style={{ background: "var(--gray)", borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>Today's rank</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>#{r.rank} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>of {r.players}</span></div>
            </div>
            <div style={{ background: "var(--amber-light)", borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#92400e" }}>Sprint streak</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#92400e" }}>{r.streak} day{r.streak === 1 ? "" : "s"}</div>
            </div>
          </div>
        </div>

        <a className="btn btn-blue" style={{ justifyContent: "center", background: "#047857", height: 50 }} href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
          onClick={() => { try { window.gtag?.("event", "sprint_share"); } catch { /* ignore */ } }}>
          Challenge friends on WhatsApp
        </a>
        <button className="btn btn-outline" style={{ justifyContent: "center", height: 48 }} onClick={startPractice}>Practise these 5 again (not ranked)</button>

        {board?.top?.length > 0 && (
          <div className="card">
            <p style={{ fontWeight: 800, marginBottom: 8 }}>Today's top {board.top.length} · {board.group}</p>
            {board.top.map((t) => (
              <div key={t.rank} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--gray2)", fontWeight: t.me ? 800 : 500, color: t.me ? ink : "var(--text)" }}>
                <span>#{t.rank} {t.name}{t.me ? " (you)" : ""}</span><span>{t.score}/5 · {secs(t.timeMs)}s</span>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ display: "grid", gap: 14 }}>
          <p style={{ fontWeight: 800 }}>Answers</p>
          {r.review.map((q, i) => {
            const ok = q.yours === q.answer;
            return (
              <div key={q.id} style={{ borderTop: i ? "1px solid var(--gray2)" : "none", paddingTop: i ? 12 : 0 }}>
                <p style={{ fontSize: 12, color: "var(--text3)" }}>{q.subject} · {q.chapter}</p>
                <p style={{ fontWeight: 600, margin: "4px 0 6px" }}>{i + 1}. {q.text}</p>
                <p style={{ fontSize: 14, color: ok ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                  {q.yours === null ? "Not answered" : ok ? `✓ ${q.options[q.yours]}` : `✗ You chose ${q.options[q.yours]}`}
                  {!ok && <span style={{ color: "var(--green)" }}> · Correct: {q.options[q.answer]}</span>}
                </p>
                {q.explanation && <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-line" }}>{q.explanation}</p>}
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>A new Sprint unlocks at midnight. We'll remind you at 7 PM if reminders are on.</p>
      </div>
    </>
  );
}
