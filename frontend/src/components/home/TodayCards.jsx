// Cards for the top of the home screen:
//  0. 60-Second Sprint (links to /sprint) — today's ranked speed round.
//  1. Question of the Day (links to /qotd) — a reason to open YNeet every day.
//  2. "Turn on daily reminders" — asks for notification permission once, with a
//     clear reason, instead of the browser's cold prompt on first load.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { pushSupported, pushPermission, enablePush, pushCardDismissed, dismissPushCard } from "../../utils/push";

export default function TodayCards() {
  const [q, setQ] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [maps, setMaps] = useState(null);
  const [teaser, setTeaser] = useState(null);
  const [showPush, setShowPush] = useState(() => pushSupported() && pushPermission() === "default" && !pushCardDismissed());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.get("/public/qotd").then((r) => setQ(r.data.today)).catch(() => {});
    api.get("/sprint/status").then((r) => setSprint(r.data)).catch(() => {});
    api.get("/weekly/maps").then((r) => setMaps(r.data)).catch(() => {});
    api.get("/weekly/teaser").then((r) => setTeaser(r.data.current)).catch(() => {});
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "on") { setNote("Done! Your first reminder is on its way."); setTimeout(() => setShowPush(false), 2500); }
      else if (r === "denied") { setNote("Notifications are blocked. You can allow them later in your phone's settings."); dismissPushCard(); }
      else setShowPush(false);
    } catch {
      setNote("Couldn't turn them on. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
      {showPush && (
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderColor: "var(--blue-light)", background: "#f5f8ff" }}>
          <div style={{ fontSize: 28 }} aria-hidden="true">🔔</div>
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>Get a NEET question every morning</p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>{note || "Question of the Day at 7 AM, the Sprint at 7 PM, and a nudge at night if you haven't practised."}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { dismissPushCard(); setShowPush(false); }}>Not now</button>
            <button className="btn btn-blue btn-sm" disabled={busy} onClick={turnOn}>{busy ? "Turning on..." : "Turn on"}</button>
          </div>
        </div>
      )}
      {sprint && (
        <Link to="/sprint" className="card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "#fff", background: "#3b2fc9", borderColor: "#3b2fc9" }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: "#f5a623", color: "#1e1b4b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
            {sprint.played ? `${sprint.score}/5` : "60s"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{sprint.played ? `Today's Sprint: rank #${sprint.rank} of ${sprint.players}` : "Today's 60-Second Sprint"}</p>
            <p style={{ fontSize: 13, color: "#c7d2fe" }}>
              {sprint.played
                ? (sprint.streak > 1 ? `${sprint.streak}-day streak · see answers and top 10` : "See answers and today's top 10")
                : `5 questions, 60 seconds${sprint.players ? ` · ${sprint.players} played today` : ""}`}
            </p>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#f5a623" }}>{sprint.played ? "View →" : "Play →"}</span>
        </Link>
      )}
      {teaser && !teaser.revealed && (
        <Link to="/teaser" className="card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "#1e1b4b", background: "#fef3c7", borderColor: "#fde68a" }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: "#f5a623", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, flexShrink: 0 }} aria-hidden="true">?</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{teaser.myChoice === null ? `Brain Teaser: ${teaser.title}` : "Answer locked"}</p>
            <p style={{ fontSize: 13, color: "#78350f" }}>{teaser.myChoice === null ? "3 clues, 4 choices. Can you guess it?" : "The answer comes out Thursday 7 PM"}</p>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{teaser.myChoice === null ? "Guess →" : "View →"}</span>
        </Link>
      )}
      {teaser && teaser.revealed && teaser.myChoice !== null && (
        <Link to="/teaser" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <p style={{ fontWeight: 800, fontSize: 15 }}>Brain Teaser answer is out: {teaser.myChoice === teaser.answer ? "you got it! 🎉" : "see the answer"}</p>
        </Link>
      )}
      {maps?.maps?.[0] && maps.latestIsNew && (
        <Link to={`/maps/${maps.maps[0].id}`} className="card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3b2fc9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="4" cy="5" r="2" /><circle cx="20" cy="5" r="2" /><circle cx="4" cy="19" r="2" /><circle cx="20" cy="19" r="2" /><path d="M6 6l4 4M18 6l-4 4M6 18l4-4M18 18l-4-4" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#3b2fc9" }}>CONCEPT MAP OF THE WEEK</p>
            <p style={{ fontWeight: 800, fontSize: 15 }}>{maps.maps[0].title}</p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>The whole chapter on one page</p>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--blue-mid)" }}>Open →</span>
        </Link>
      )}
      {q && (
        <Link to="/qotd" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", padding: "3px 10px", borderRadius: 10 }}>Question of the Day</span>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{q.subject}</span>
          </div>
          <p style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.45 }}>{q.question.length > 160 ? q.question.slice(0, 159) + "…" : q.question}</p>
          <p style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: "var(--blue-mid)" }}>Answer now →</p>
        </Link>
      )}
    </div>
  );
}
