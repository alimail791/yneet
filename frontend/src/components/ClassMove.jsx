import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

// "Moved to the next class?" — the student moves up one class (7th → 8th,
// 11th → 12th, 12th → Dropper). Their tests, progress and plan stay; the content
// switches to the new class. Allowed once every ~5 months (checked on the server).
const LADDER = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const label = (c) => (c === "Dropper" ? "Dropper" : `Class ${String(c).replace("th", "")}`);

export default function ClassMove() {
  const { user, refreshUser } = useAuth();
  const current = user?.profile?.class;
  const next = LADDER[LADDER.indexOf(current) + 1];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  if (!current) return null;

  const move = async () => {
    const extra = current === "8th" ? "\n\nFrom Class 9 you get NEET Foundation tests. You'll get 30 days of full access free." :
      current === "12th" ? "\n\nAs a Dropper you'll get full NEET mocks and revision for the next NEET." : "";
    if (!window.confirm(`Move from ${label(current)} to ${label(next)}?\n\nYour tests, progress and plan stay. Questions and tests will switch to ${label(next)}. You can only move up once every few months.${extra}`)) return;
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.post("/user/next-class", { to: next });
      await refreshUser?.();
      setMsg({ ok: true, text: `Done! You're now in ${label(data.to)}.${data.trialStarted ? " Your 30-day free trial has started." : ""}` });
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.message || "Couldn't change your class. Please try again or message us on WhatsApp." });
    }
    setBusy(false);
  };

  return (
    <div className="card mb-5">
      <div className="section-title" style={{ fontSize: 17 }}>Your class</div>
      <p style={{ fontSize: 14, color: "var(--text2)", margin: "6px 0 12px" }}>
        You're in <b>{label(current)}</b>.{" "}
        {next ? <>Passed to the next class? Move up to <b>{label(next)}</b>. Your progress stays.</> : "This is the last level."}
      </p>
      {next && (
        <button className="btn btn-blue btn-sm" onClick={move} disabled={busy}>
          {busy ? "Moving..." : `Move to ${label(next)}`}
        </button>
      )}
      {msg && <p style={{ fontSize: 13, marginTop: 10, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</p>}
    </div>
  );
}
