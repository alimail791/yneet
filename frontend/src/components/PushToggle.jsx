// Profile → Daily reminders on/off for this device.
import { useEffect, useState } from "react";
import { pushSupported, pushPermission, pushIsOn, enablePush, disablePush } from "../utils/push";

export default function PushToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { pushIsOn().then(setOn).catch(() => {}); }, []);
  if (!pushSupported()) return null;

  const toggle = async () => {
    setBusy(true); setNote("");
    try {
      if (on) { await disablePush(); setOn(false); }
      else {
        const r = await enablePush();
        if (r === "on") setOn(true);
        else if (r === "denied") setNote("Notifications are blocked for YNeet. Allow them in your phone's settings, then try again.");
        else setNote("Reminders aren't available right now.");
      }
    } catch { setNote("Something went wrong. Please try again."); }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <p style={{ fontWeight: 700 }}>Daily reminders on this phone</p>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>
          {note || (pushPermission() === "denied" ? "Blocked in your phone's settings." : "Question of the Day at 7 AM, and a reminder at 8:30 PM if you haven't practised.")}
        </p>
      </div>
      <button className={on ? "btn btn-outline btn-sm" : "btn btn-blue btn-sm"} disabled={busy} onClick={toggle}>
        {busy ? "..." : on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
