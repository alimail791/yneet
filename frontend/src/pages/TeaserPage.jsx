// Brain Teaser of the week (Class 6–8 science, open to everyone).
// Lock one answer; the answer and how many got it right appear the next day at 7 PM.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

const SHARE_LINK = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "") + "/brain-teaser";
const when = (iso) => new Date(iso).toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit" });

function Teaser({ t, onAnswer, busy }) {
  const [pick, setPick] = useState(null);
  const locked = t.myChoice !== null && t.myChoice !== undefined;
  const shareText = `Who am I? 🧠\n${t.clues.map((c, i) => `${i + 1}. ${c}`).join("\n")}\nGuess on YNeet: ${SHARE_LINK}`;
  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#92400e", background: "var(--amber-light)", padding: "4px 10px", borderRadius: 10 }}>BRAIN TEASER</span>
        {t.topic && <span style={{ fontSize: 12, color: "var(--text3)" }}>{t.topic}</span>}
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 800 }}>{t.title}</h2>
      <ol style={{ paddingLeft: 22, display: "grid", gap: 8, fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>
        {t.clues.map((c, i) => <li key={i}>{c}</li>)}
      </ol>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {t.options.map((o, i) => {
          let border = "var(--gray3)", bg = "#fff";
          if (t.revealed && i === t.answer) { border = "var(--green)"; bg = "var(--green-light)"; }
          else if (t.revealed && i === t.myChoice) { border = "var(--red)"; bg = "var(--red-light)"; }
          else if (!t.revealed && (locked ? i === t.myChoice : i === pick)) { border = "#3b2fc9"; bg = "#eef2ff"; }
          return (
            <button key={i} disabled={locked || t.revealed} onClick={() => setPick(i)}
              style={{ minHeight: 56, padding: "8px 12px", borderRadius: 14, border: `2px solid ${border}`, background: bg, fontSize: 16, fontWeight: 700, color: "var(--text)", cursor: locked || t.revealed ? "default" : "pointer", textAlign: "left" }}>
              {"ABCD"[i]}. {o}
            </button>
          );
        })}
      </div>
      {!t.revealed && !locked && (
        <button className="btn btn-blue" style={{ justifyContent: "center", height: 50 }} disabled={pick === null || busy} onClick={() => onAnswer(pick)}>
          {busy ? "Locking…" : "Lock my answer"}
        </button>
      )}
      {!t.revealed && locked && (
        <p style={{ fontSize: 15, color: "var(--text2)" }}>Locked: <strong>{"ABCD"[t.myChoice]}. {t.options[t.myChoice]}</strong>. The answer comes out {when(t.revealAt)}.</p>
      )}
      {t.revealed && (
        <div style={{ display: "grid", gap: 6 }}>
          <p style={{ fontWeight: 800, color: t.myChoice === t.answer ? "var(--green)" : t.myChoice === null ? "var(--text)" : "var(--red)" }}>
            {t.myChoice === null ? `Answer: ${t.options[t.answer]}` : t.myChoice === t.answer ? "You got it! 🎉" : `Not this time. Answer: ${t.options[t.answer]}`}
          </p>
          {t.explanation && <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5 }}>{t.explanation}</p>}
          {t.players > 0 && <p style={{ fontSize: 13, color: "var(--text3)" }}>{t.correctPct}% of {t.players} students got it right.</p>}
        </div>
      )}
      {!t.revealed && (
        <a className="btn btn-outline" style={{ justifyContent: "center" }} href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">Challenge a friend on WhatsApp</a>
      )}
    </div>
  );
}

export default function TeaserPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/weekly/teaser").then((r) => setData(r.data)).catch(() => setData({})); }, []);

  const answer = async (choice) => {
    setBusy(true);
    try { const { data: d } = await api.post(`/weekly/teaser/${data.current.id}/answer`, { choice }); setData({ ...data, current: d.current }); }
    catch (e) { alert(e?.response?.data?.message || "Couldn't save your answer."); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "18px 16px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 14 }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← Home</Link>
        {!data && <div className="loading-screen"><div className="spinner"></div></div>}
        {data && !data.current && <div className="card">The first Brain Teaser arrives on Wednesday.</div>}
        {data?.current && <Teaser t={data.current} onAnswer={answer} busy={busy} />}
        {data?.previous && (
          <>
            <p style={{ fontWeight: 800, marginTop: 8 }}>Last week's teaser</p>
            <Teaser t={data.previous} onAnswer={() => {}} busy={false} />
          </>
        )}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>A new Brain Teaser every Wednesday.</p>
      </div>
    </div>
  );
}
