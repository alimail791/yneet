import { useEffect, useState } from "react";
import api from "../lib/api";

// Profile → Parent Updates: weekly email to a parent + one-tap WhatsApp share
// of the same report. The parent's WhatsApp number is only remembered on this
// device (localStorage) — it's used to pre-fill the chat, nothing is sent by us.
const WA_KEY = "yneet_parent_whatsapp";
const readWa = () => { try { return localStorage.getItem(WA_KEY) || ""; } catch { return ""; } };
const saveWa = (v) => { try { v ? localStorage.setItem(WA_KEY, v) : localStorage.removeItem(WA_KEY); } catch {} };
const waDigits = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  return "";
};

export default function ParentUpdates() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [lastSent, setLastSent] = useState(null);
  const [text, setText] = useState("");
  const [wa, setWa] = useState(readWa());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/user/parent-report");
      setEmail(data.parentEmail); setSavedEmail(data.parentEmail); setLastSent(data.lastSent); setText(data.text);
    } catch { setMsg({ err: true, t: "Couldn't load your report. Try again later." }); }
    setLoading(false);
  };
  useEffect(() => {
    load();
    if (window.location.hash === "#parent-updates") setTimeout(() => document.getElementById("parent-updates")?.scrollIntoView({ behavior: "smooth" }), 300);
  }, []);

  const flash = (t, err = false) => { setMsg({ t, err }); setTimeout(() => setMsg(null), 5000); };

  const saveEmail = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/user/parent-email", { parentEmail: email });
      setSavedEmail(data.parentEmail);
      if (!data.parentEmail) flash("Parent email removed. Weekly emails stopped.");
      else flash(data.sent ? `Saved! This week's report has been sent to ${data.parentEmail}. Next one in 7 days.` : "Saved. Weekly reports will go to this email.");
      load();
    } catch (err) { flash(err?.response?.data?.message || "Couldn't save. Try again.", true); }
    setBusy(false);
  };

  const emailNow = async () => {
    setBusy(true);
    try { await api.post("/user/parent-report/email"); flash(`Report emailed to ${savedEmail}.`); load(); }
    catch (err) { flash(err?.response?.data?.message || "Couldn't send. Try again.", true); }
    setBusy(false);
  };

  const shareWhatsApp = () => {
    const num = waDigits(wa);
    if (wa && !num) { flash("Enter a valid 10-digit WhatsApp number, or leave it empty to choose a contact.", true); return; }
    saveWa(wa.trim());
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const emailChanged = email.trim().toLowerCase() !== (savedEmail || "");

  return (
    <div className="card mb-5" id="parent-updates">
      <div className="section-header">
        <div className="section-title">👨‍👩‍👧 Parent Updates</div>
        {savedEmail && <span className="chip chip-green">Weekly email on</span>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text2)", margin: "4px 0 16px" }}>
        Keep your parents in the loop. They get a weekly report of your tests, scores, study days and the chapters to work on.
      </p>

      {loading ? <p style={{ fontSize: 13, color: "var(--text3)" }}>Loading…</p> : (
        <>
          <div className="grid2 mb-4">
            <div className="form-group">
              <label className="form-label">Parent's email <span className="optional-tag">(weekly report)</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" type="email" placeholder="parent@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn btn-blue" disabled={busy || !emailChanged} onClick={saveEmail}>{savedEmail && !email ? "Remove" : "Save"}</button>
              </div>
              {savedEmail && <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                {lastSent ? `Last sent ${new Date(lastSent).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. ` : ""}Sent automatically every 7 days.
              </p>}
            </div>
            <div className="form-group">
              <label className="form-label">Parent's WhatsApp <span className="optional-tag">(optional)</span></label>
              <input className="form-input" type="tel" placeholder="10-digit number" value={wa} onChange={(e) => setWa(e.target.value)} />
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Saved on this phone only. Leave empty to pick the contact in WhatsApp.</p>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button className="btn" onClick={shareWhatsApp} disabled={!text}
              style={{ background: "#25D366", color: "#fff", border: "none", fontWeight: 700 }}>
              📲 Share report on WhatsApp
            </button>
            {savedEmail && <button className="btn btn-outline" onClick={emailNow} disabled={busy}>✉️ Email report now</button>}
            <button className="btn btn-outline" onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Hide preview" : "👀 Preview report"}</button>
          </div>

          {msg && <p style={{ fontSize: 13, marginTop: 12, color: msg.err ? "var(--red)" : "var(--green)" }}>{msg.t}</p>}
          {showPreview && (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, background: "var(--gray2)", padding: 14, borderRadius: "var(--r)", marginTop: 14, color: "var(--text)" }}>{text}</pre>
          )}
        </>
      )}
    </div>
  );
}
