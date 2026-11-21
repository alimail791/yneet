// Admin → Institute emails. Automatic follow-up emails that sell the YNeet
// institute pack to schools and coaching centres (backend utils/instituteDrip.js).
// Starts paused: preview, send yourself a test, import leads, then Start.
import { useEffect, useState } from "react";
import api from "../../lib/api";

const err = (e) => alert(e?.response?.data?.message || e.message || "Something went wrong");
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
const stat = (label, value, sub) => (
  <div className="card">
    <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--blue)", marginTop: 6 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function AdminInstituteEmailsPage() {
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("alimail791@gmail.com");
  const [csv, setCsv] = useState("");
  const [kind, setKind] = useState("coaching");

  const load = (query = q) => api.get(`/admin/institute-drip?q=${encodeURIComponent(query)}`).then((r) => setD(r.data)).catch(err);
  useEffect(() => { load(""); }, []);

  const act = async (fn, done) => {
    setBusy(true);
    try { const r = await fn(); if (done) alert(done(r.data)); await load(); } catch (e) { err(e); }
    setBusy(false);
  };

  const toggle = () => {
    const on = !d.enabled;
    if (on && !window.confirm(`Start sending? Up to ${d.dailyCap} emails a day go out, 9am–7pm IST, to ${d.leads.active} active leads.`)) return;
    act(() => api.post("/admin/institute-drip/toggle", { on }), () => (on ? "Started. Emails go out 9am–7pm IST in small batches." : "Paused."));
  };

  const readFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setCsv(String(r.result));
    r.readAsText(f);
  };

  const setStatus = (email, status) => {
    const note = status === "stopped" ? window.prompt("Why stop? (bought / replied / not interested)", "bought") : "";
    if (note === null) return;
    act(() => api.post("/admin/institute-drip/lead-status", { email, status, note }));
  };

  if (!d) return <div className="spinner" />;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Institute pack: email follow-ups</h1>
          <p style={{ color: "var(--text2)", fontSize: 14 }}>
            4 automatic emails to schools, institutes and coaching centres, offering the free 14-day pilot and the institute pack.
          </p>
        </div>
        <button className={d.enabled ? "btn btn-outline" : "btn btn-blue"} disabled={busy || !d.configured} onClick={toggle}>
          {d.enabled ? "⏸ Pause sending" : "▶ Start sending"}
        </button>
      </div>

      {!d.configured && <div className="card" style={{ color: "var(--red)", fontWeight: 600 }}>RESEND_API_KEY is not set, so nothing can be sent.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {stat("Status", d.enabled ? "Sending" : "Paused", `9am–7pm IST · up to ${d.dailyCap}/day`)}
        {stat("Leads", d.leads.total, `${d.leads.coaching} coaching · ${d.leads.schools} schools`)}
        {stat("Still in sequence", d.leads.active, `${d.leads.stopped} stopped · ${d.leads.unsubscribed} unsubscribed`)}
        {stat("Sent today", d.sentToday, `of ${d.dailyCap}`)}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text3)", fontSize: 12 }}>
              <th style={{ padding: 8 }}>#</th><th style={{ padding: 8 }}>When</th><th style={{ padding: 8 }}>Subject (click to preview)</th>
              <th style={{ padding: 8 }}>Sent</th><th style={{ padding: 8 }}>Due now</th><th style={{ padding: 8 }}>Failed</th>
            </tr>
          </thead>
          <tbody>
            {d.steps.map((s, i) => (
              <tr key={s.step} style={{ borderTop: "1px solid var(--gray3)", verticalAlign: "top" }}>
                <td style={{ padding: 8 }}>{s.step}</td>
                <td style={{ padding: 8, fontSize: 13, whiteSpace: "nowrap" }}>{i === 0 ? "First" : `${s.gapDays} days after #${i}`}</td>
                <td style={{ padding: 8 }}>
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>{s.subject}</summary>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, background: "#f8fafc", padding: 12, borderRadius: 8, marginTop: 8 }}>{s.preview}</pre>
                  </details>
                </td>
                <td style={{ padding: 8 }}>{s.sent}</td><td style={{ padding: 8 }}>{s.dueNow}</td><td style={{ padding: 8 }}>{s.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>From {d.from} · replies go to {d.replyTo}. Previews use a sample coaching centre; schools get one extra line about Class 6–10 tests.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <div className="card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <strong>1. Send yourself a test</strong>
          <input className="form-input" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} disabled={busy}
            onClick={() => act(() => api.post("/admin/institute-drip/test", { to: testTo }), (r) => `Sent all 4 test emails to ${r.to}. Check inbox and spam.`)}>
            Send test emails
          </button>
        </div>

        <div className="card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <strong>2. Add leads</strong>
          <input type="file" accept=".csv,.txt" onChange={readFile} />
          <textarea className="form-input" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)}
            placeholder={"CSV with an Email column (plus Institute, Contact name, City, Type if you have them)\nor paste one per line: name,email"} />
          <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            If the type isn't in the file, treat as
            <select className="form-input" style={{ width: 160 }} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="coaching">Coaching / institute</option>
              <option value="school">School</option>
            </select>
          </label>
          <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} disabled={busy || !csv.trim()}
            onClick={() => act(() => api.post("/admin/institute-drip/import", { csv, kind }), (r) => { setCsv(""); return `Imported ${r.added} new lead(s); ${r.skipped} skipped (duplicates or not an email).`; })}>
            Import leads
          </button>
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <strong>Leads {q ? `matching "${q}"` : "(latest 50)"}</strong>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: "flex", gap: 8 }}>
            <input className="form-input" style={{ width: 240 }} placeholder="Search email, institute, city" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-outline btn-sm">Search</button>
          </form>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text3)", fontSize: 12 }}>
                <th style={{ padding: 6 }}>Institute</th><th style={{ padding: 6 }}>Email</th><th style={{ padding: 6 }}>City</th>
                <th style={{ padding: 6 }}>Emails sent</th><th style={{ padding: 6 }}>Last</th><th style={{ padding: 6 }}>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {d.recent.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--gray3)" }}>
                  <td style={{ padding: 6 }}>{l.institute || "—"}{l.name ? <div style={{ color: "var(--text3)" }}>{l.name}</div> : null}</td>
                  <td style={{ padding: 6 }}>{l.email}</td>
                  <td style={{ padding: 6 }}>{l.city || "—"} · {l.kind}</td>
                  <td style={{ padding: 6 }}>{l.last_step} of 4</td>
                  <td style={{ padding: 6 }}>{fmt(l.last_sent)}</td>
                  <td style={{ padding: 6, color: l.status === "active" && !l.bounced ? "var(--green)" : "var(--text3)" }}>
                    {l.bounced ? "bounced" : l.status}{l.note ? ` (${l.note})` : ""}
                  </td>
                  <td style={{ padding: 6 }}>
                    {l.status === "active" && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setStatus(l.email, "stopped")}>Stop</button>}
                    {l.status === "stopped" && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setStatus(l.email, "active")}>Restart</button>}
                  </td>
                </tr>
              ))}
              {d.recent.length === 0 && <tr><td colSpan={7} style={{ padding: 10, color: "var(--text3)" }}>No leads yet. Import a CSV above.</td></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--text3)" }}>
          Press <b>Stop</b> when an institute buys, replies or says no, so they get no more emails. Unsubscribes and bounced emails are skipped automatically.
          Links are tagged utm_source=email, utm_medium=institute_drip, so visits show up in Google Analytics.
        </p>
      </div>
    </div>
  );
}
