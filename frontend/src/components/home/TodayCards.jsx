// Two cards for the top of the home screen:
//  1. Question of the Day (links to /qotd) — a reason to open YNeet every day.
//  2. "Turn on daily reminders" — asks for notification permission once, with a
//     clear reason, instead of the browser's cold prompt on first load.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { pushSupported, pushPermission, enablePush, pushCardDismissed, dismissPushCard } from "../../utils/push";

export default function TodayCards() {
  const [q, setQ] = useState(null);
  const [showPush, setShowPush] = useState(() => pushSupported() && pushPermission() === "default" && !pushCardDismissed());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.get("/public/qotd").then((r) => setQ(r.data.today)).catch(() => {});
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
            <p style={{ fontSize: 13, color: "var(--text2)" }}>{note || "One question at 7 AM and a gentle reminder at night if you haven't practised. Nothing else."}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { dismissPushCard(); setShowPush(false); }}>Not now</button>
            <button className="btn btn-blue btn-sm" disabled={busy} onClick={turnOn}>{busy ? "Turning on..." : "Turn on"}</button>
          </div>
        </div>
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
