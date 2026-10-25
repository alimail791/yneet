import { useEffect, useRef, useState, useCallback } from "react";
import api from "../lib/api";

const SUBJECT_ICON = { Physics: "⚛️", Chemistry: "🧪", Biology: "🧬" };

function formatDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// One video. Nothing heavy loads until the student taps play — this keeps the
// feed fast on mobile data — and the player unmounts when its slide scrolls away,
// which also stops the audio.
export function ShortPlayer({ short, active, onPlay }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);

  const start = () => { setPlaying(true); onPlay(short); };

  if (playing) {
    if (short.provider === "youtube") {
      return (
        <iframe
          className="short-frame"
          src={`https://www.youtube-nocookie.com/embed/${short.videoRef}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
          title={short.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      );
    }
    if (short.provider === "bunny") {
      return (
        <iframe
          className="short-frame"
          src={`https://iframe.mediadelivery.net/embed/${short.videoRef}?autoplay=true&preload=true&responsive=true`}
          title={short.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      );
    }
    return <video className="short-frame" src={short.videoRef} controls autoPlay playsInline controlsList="nodownload" />;
  }

  const thumb = short.provider === "youtube" ? `https://i.ytimg.com/vi/${short.videoRef}/hqdefault.jpg` : null;
  return (
    <button className="short-poster" onClick={start} aria-label={`Play ${short.title}`}
      style={thumb ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,.15),rgba(15,23,42,.65)),url(${thumb})` } : undefined}>
      {!thumb && <span className="short-poster-icon">{SUBJECT_ICON[short.subject] || "🎬"}</span>}
      <span className="short-play">▶</span>
      {formatDuration(short.durationSec) && <span className="short-duration">{formatDuration(short.durationSec)}</span>}
    </button>
  );
}

// Bottom sheet with the quick-check MCQs, one at a time.
function QuickCheck({ short, onClose, onScored }) {
  const qs = short.questions;
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null); // { isCorrect, correctOpt, explanation }
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const q = qs[idx];

  const answer = async (opt) => {
    if (result || busy) return;
    setPicked(opt); setBusy(true);
    try {
      const { data } = await api.post(`/shorts/${short.id}/answer`, { questionId: q.id, selected: opt });
      setResult(data);
      if (data.isCorrect) setCorrectCount(c => c + 1);
      onScored(short.id, q.id, data.isCorrect);
    } catch {
      setPicked(null);
      alert("Couldn't check that answer — please try again.");
    }
    setBusy(false);
  };

  const next = () => {
    if (idx + 1 >= qs.length) { setDone(true); return; }
    setIdx(i => i + 1); setPicked(null); setResult(null);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Quick check">
        <div className="sheet-handle" />
        {!done ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="chip chip-purple">Quick check · {idx + 1}/{qs.length}</span>
              <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
            </div>
            <p className="quiz-q">{q.questionText}</p>
            {["optionA", "optionB", "optionC", "optionD"].map((key, i) => {
              let cls = "quiz-opt";
              if (result) {
                cls += " locked";
                if (i === result.correctOpt) cls += " correct";
                else if (i === picked) cls += " wrong";
              } else if (i === picked) cls += " selected";
              return (
                <div key={key} className={cls} onClick={() => answer(i)}>
                  <div className="opt-key">{"ABCD"[i]}</div>
                  <div>{q[key]}</div>
                </div>
              );
            })}
            {result && (
              <div className="insight" style={{ borderColor: result.isCorrect ? "var(--green)" : "var(--red)", background: result.isCorrect ? "var(--green-light)" : "var(--red-light)", marginTop: 6 }}>
                <strong style={{ fontSize: 14 }}>{result.isCorrect ? "✅ Correct!" : "❌ Not quite"}</strong>
                {result.explanation && <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>{result.explanation}</p>}
                {!result.isCorrect && <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Saved to your Mistake Notebook.</p>}
              </div>
            )}
            <button className="btn btn-blue btn-full" style={{ marginTop: 12 }} disabled={!result} onClick={next}>
              {idx + 1 >= qs.length ? "See score" : "Next question →"}
            </button>
          </>
        ) : (
          <div className="text-center" style={{ padding: "12px 0 6px" }}>
            <div style={{ fontSize: 44 }}>{correctCount === qs.length ? "🏆" : correctCount > 0 ? "👏" : "💪"}</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "6px 0" }}>{correctCount}/{qs.length} correct</h2>
            <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 18 }}>
              {correctCount === qs.length ? "You've nailed this concept. On to the next Short!" : "Rewatch the Short and try again — wrong ones are in your Mistake Notebook."}
            </p>
            <button className="btn btn-blue btn-full" onClick={onClose}>Back to Shorts</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [quizFor, setQuizFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [reload, setReload] = useState(0);
  const feedRef = useRef(null);
  const viewedRef = useRef(new Set());

  useEffect(() => {
    setLoading(true); setError(null);
    api.get("/shorts", { params: { subject: subject || undefined, language: language || undefined } })
      .then(r => { setData(r.data); setActiveId(r.data.shorts[0]?.id || null); feedRef.current?.scrollTo({ top: 0 }); })
      .catch(err => { if (err.response?.status !== 402) setError("Couldn't load Shorts. Please try again."); })
      .finally(() => setLoading(false));
  }, [subject, language, reload]);

  // Whichever slide is mostly on screen is the "active" one.
  useEffect(() => {
    const root = feedRef.current;
    if (!root || !data?.shorts.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveId(e.target.dataset.id); });
    }, { root, threshold: 0.6 });
    root.querySelectorAll("[data-id]").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [data]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handlePlay = useCallback((short) => {
    if (short.watched || viewedRef.current.has(short.id)) return;
    viewedRef.current.add(short.id);
    api.post(`/shorts/${short.id}/view`).then(r => {
      if (r.data.firstView) {
        setData(d => ({ ...d, watchedCount: d.watchedCount + 1, shorts: d.shorts.map(s => s.id === short.id ? { ...s, watched: true } : s) }));
        if (r.data.xp?.points) showToast(`+${r.data.xp.points} XP for learning something new`);
      }
    }).catch(() => viewedRef.current.delete(short.id));
  }, []);

  const handleScored = useCallback((shortId, questionId, isCorrect) => {
    setData(d => ({
      ...d,
      shorts: d.shorts.map(s => {
        if (s.id !== shortId) return s;
        const quiz = s.quiz || { correct: 0, total: 0, answeredIds: [] };
        if (quiz.answeredIds.includes(questionId)) return s;
        return { ...s, watched: true, quiz: { correct: quiz.correct + (isCorrect ? 1 : 0), total: quiz.total + 1, answeredIds: [...quiz.answeredIds, questionId] } };
      }),
    }));
  }, []);

  const chipStyle = (on) => ({
    cursor: "pointer", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", border: "none",
    background: on ? "linear-gradient(135deg,var(--blue),var(--purple))" : "var(--gray2)", color: on ? "#fff" : "var(--text2)",
  });

  const shorts = data?.shorts || [];
  const quizShort = shorts.find(s => s.id === quizFor);

  return (
    <div className="shorts-page">
      <div className="shorts-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div className="section-title" style={{ fontSize: 20 }}>🎬 YNeet Shorts</div>
            <p style={{ fontSize: 12.5, color: "var(--text2)" }}>One concept in 3–5 minutes, then a quick check</p>
          </div>
          {data && <span className="chip chip-green" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{data.watchedCount} watched</span>}
        </div>
        {data && (data.subjects.length > 1 || data.languages.length > 1 || subject || language) && (
          <div className="shorts-filters">
            <button style={chipStyle(!subject)} onClick={() => setSubject("")}>All</button>
            {["Biology", "Chemistry", "Physics"].filter(s => data.subjects.includes(s) || subject === s).map(s => (
              <button key={s} style={chipStyle(subject === s)} onClick={() => setSubject(s)}>{SUBJECT_ICON[s]} {s}</button>
            ))}
            {(data.languages.length > 1 || language) && (
              <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}
                style={{ width: "auto", padding: "4px 10px", fontSize: 12, borderRadius: 20 }} aria-label="Language">
                <option value="">All languages</option>
                {data.languages.map(l => <option key={l}>{l}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {loading && <div className="shorts-empty"><div className="spinner"></div></div>}

      {!loading && error && (
        <div className="shorts-empty">
          <p style={{ color: "var(--text2)", marginBottom: 12 }}>{error}</p>
          <button className="btn btn-blue" onClick={() => setReload(n => n + 1)}>Retry</button>
        </div>
      )}

      {!loading && !error && shorts.length === 0 && (
        <div className="shorts-empty">
          <div style={{ fontSize: 44 }}>🎬</div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: "6px 0" }}>New Shorts are on the way</h3>
          <p style={{ fontSize: 14, color: "var(--text2)", maxWidth: 300 }}>
            {subject || language ? "Nothing here yet for this filter — try All." : "Short NEET concept videos for your class will appear here soon."}
          </p>
        </div>
      )}

      {!loading && !error && shorts.length > 0 && (
        <div className="shorts-feed" ref={feedRef}>
          {shorts.map(s => (
            <section key={s.id} className="short-slide" data-id={s.id}>
              <div className="short-card">
                <div className="short-video">
                  <ShortPlayer short={s} active={activeId === s.id} onPlay={handlePlay} />
                </div>
                <div className="short-info">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    <span className="chip chip-blue">{SUBJECT_ICON[s.subject]} {s.subject}</span>
                    <span className="chip" style={{ background: "var(--gray2)", color: "var(--text2)" }}>{s.chapter}</span>
                    {s.language !== "English" && <span className="chip chip-amber">{s.language}</span>}
                    {s.watched && <span className="chip chip-green">✓ Watched</span>}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{s.title}</h3>
                  <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                    by {s.creatorName}
                    {s.creatorLinks?.youtube && <> · <a href={s.creatorLinks.youtube} target="_blank" rel="noreferrer" style={{ color: "var(--red)", fontWeight: 700 }}>YouTube ↗</a></>}
                    {s.creatorLinks?.instagram && <> · <a href={s.creatorLinks.instagram} target="_blank" rel="noreferrer" style={{ color: "var(--purple)", fontWeight: 700 }}>Instagram ↗</a></>}
                  </p>
                  {s.description && <p className="short-desc">{s.description}</p>}
                  {s.questions.length > 0 && (
                    <button className="btn btn-purple btn-full" style={{ marginTop: 10 }} onClick={() => setQuizFor(s.id)}>
                      {s.quiz?.total
                        ? `📝 Quick check · ${s.quiz.correct}/${s.quiz.total} correct — try again`
                        : `📝 Quick check · ${s.questions.length} question${s.questions.length === 1 ? "" : "s"}`}
                    </button>
                  )}
                </div>
              </div>
            </section>
          ))}
          <section className="short-slide short-end">
            <div className="text-center">
              <div style={{ fontSize: 40 }}>🎯</div>
              <p style={{ fontWeight: 700, marginTop: 6 }}>You're all caught up!</p>
              <p style={{ fontSize: 13, color: "var(--text2)" }}>New Shorts are added every week.</p>
            </div>
          </section>
        </div>
      )}

      {quizShort && <QuickCheck short={quizShort} onClose={() => setQuizFor(null)} onScored={handleScored} />}
      {toast && <div className="shorts-toast">{toast}</div>}
    </div>
  );
}
