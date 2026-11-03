// Admin → Weekly: Concept Map Monday and Brain Teaser Wednesday.
// AI writes drafts; nothing reaches students until you press "Approve".
// Approving without a date puts it on the next free Monday / Wednesday.
import { useEffect, useState } from "react";
import api from "../../lib/api";
import MapView from "../../components/weekly/MapView";
import { drawMapPost, drawTeaserPost } from "../../utils/postImage";

const GROUPS = [["neet", "NEET (11, 12, Dropper)"], ["foundation", "Class 9–10"], ["junior", "Class 6–8"]];
const groupLabel = (g) => (GROUPS.find((x) => x[0] === g) || [g, g])[1];
const fmtDay = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";
const badge = (status, publishOn, today) => {
  if (status === "draft") return { text: "Draft", bg: "var(--amber-light)", fg: "#92400e" };
  if (publishOn && publishOn <= today) return { text: `Live since ${fmtDay(publishOn)}`, bg: "var(--green-light)", fg: "#065f46" };
  return { text: `Scheduled ${fmtDay(publishOn)}`, bg: "var(--blue-light)", fg: "#1e3a8a" };
};
const err = (e) => alert(e?.response?.data?.message || e.message || "Something went wrong");

export default function AdminWeeklyPage() {
  const [tab, setTab] = useState("maps");
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Weekly series</h1>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>
        AI writes drafts. Check each one, edit if needed, then Approve. Students only see approved items, from their date.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className={tab === "maps" ? "btn btn-blue" : "btn btn-outline"} onClick={() => setTab("maps")}>Concept Map Monday</button>
        <button className={tab === "teasers" ? "btn btn-blue" : "btn btn-outline"} onClick={() => setTab("teasers")}>Brain Teaser Wednesday</button>
      </div>
      {tab === "maps" ? <MapsTab /> : <TeasersTab />}
    </div>
  );
}

// ───────── Concept maps ─────────
function MapsTab() {
  const [grp, setGrp] = useState("neet");
  const [chapters, setChapters] = useState([]);
  const [pick, setPick] = useState("");
  const [maps, setMaps] = useState([]);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const load = () => api.get("/admin/weekly/maps").then((r) => { setMaps(r.data.maps); setToday(r.data.today); }).catch(err);
  useEffect(() => { load(); }, []);
  useEffect(() => { setPick(""); api.get(`/admin/weekly/chapters?grp=${grp}`).then((r) => setChapters(r.data.chapters)).catch(err); }, [grp]);

  const generate = async () => {
    const [subject, chapter] = pick.split("|");
    setBusy(true);
    try { const { data } = await api.post("/admin/weekly/maps/generate", { grp, subject, chapter }); await load(); setOpen(data.map.id); }
    catch (e) { err(e); }
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select className="form-select" style={{ width: 200 }} value={grp} onChange={(e) => setGrp(e.target.value)}>
          {GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="form-select" style={{ flex: "1 1 260px" }} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Pick a chapter…</option>
          {chapters.map((c) => <option key={`${c.subject}|${c.chapter}`} value={`${c.subject}|${c.chapter}`}>{c.done ? "✓ " : ""}{c.subject} · {c.chapter} ({c.n} Qs)</option>)}
        </select>
        <button className="btn btn-blue" disabled={!pick || busy} onClick={generate}>{busy ? "AI is writing… (about 20 s)" : "Generate draft"}</button>
      </div>
      {maps.length === 0 && <p style={{ color: "var(--text3)" }}>No concept maps yet. Pick a chapter and press Generate.</p>}
      {maps.map((m) => <MapRow key={m.id} m={m} today={today} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} reload={load} />)}
    </div>
  );
}

function MapRow({ m, today, open, onToggle, reload }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState(m.data);
  const [date, setDate] = useState(m.publish_on || "");
  useEffect(() => { setD(m.data); setDate(m.publish_on || ""); }, [m]);
  const b = badge(m.status, m.publish_on, today);

  const save = async (patch) => {
    try { await api.put(`/admin/weekly/maps/${m.id}`, patch); setEdit(false); reload(); } catch (e) { err(e); }
  };
  const setBranch = (i, k, v) => setD({ ...d, branches: d.branches.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onToggle} style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{m.data.title}</span>
          <span style={{ color: "var(--text2)", fontSize: 13 }}> · {m.subject} · {groupLabel(m.grp)}</span>
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: b.bg, color: b.fg }}>{b.text}</span>
      </div>
      {open && (
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {!edit ? <MapView map={m.data} subject={m.subject} chapter={m.chapter} /> : (
            <div style={{ display: "grid", gap: 10 }}>
              <label className="form-label">Title<input className="form-input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
              <label className="form-label">Core idea<input className="form-input" value={d.center.heading} onChange={(e) => setD({ ...d, center: { ...d.center, heading: e.target.value } })} /></label>
              <label className="form-label">Key equation / definition<input className="form-input" value={d.center.detail} onChange={(e) => setD({ ...d, center: { ...d.center, detail: e.target.value } })} /></label>
              {d.branches.map((br, i) => (
                <div key={i} style={{ display: "grid", gap: 6, padding: 10, border: "1px solid var(--gray3)", borderRadius: 10 }}>
                  <input className="form-input" value={br.heading} onChange={(e) => setBranch(i, "heading", e.target.value)} placeholder="Branch heading" />
                  <textarea className="form-input" rows={4} value={br.points.join("\n")} onChange={(e) => setBranch(i, "points", e.target.value.split("\n"))} placeholder="One point per line" />
                </div>
              ))}
              <label className="form-label">Remember (one high-yield fact)<textarea className="form-input" rows={2} value={d.remember} onChange={(e) => setD({ ...d, remember: e.target.value })} /></label>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {edit ? (
              <>
                <button className="btn btn-blue btn-sm" onClick={() => save({ data: { ...d, branches: d.branches.map((x) => ({ ...x, points: x.points.filter((p) => p.trim()) })) } })}>Save changes</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setD(m.data); setEdit(false); }}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn btn-outline btn-sm" onClick={() => setEdit(true)}>Edit</button>
                {m.status === "draft"
                  ? <button className="btn btn-blue btn-sm" onClick={() => save({ status: "approved", publishOn: date || undefined })}>Approve{date ? ` for ${fmtDay(date)}` : " (next free Monday)"}</button>
                  : <button className="btn btn-outline btn-sm" onClick={() => save({ status: "draft" })}>Unpublish</button>}
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Date
                  <input type="date" className="form-input" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                {m.status === "approved" && date !== (m.publish_on || "") && date && <button className="btn btn-outline btn-sm" onClick={() => save({ publishOn: date })}>Move to {fmtDay(date)}</button>}
                <button className="btn btn-outline btn-sm" onClick={() => drawMapPost(m.data, m.subject, m.chapter)}>Download post image</button>
                <button className="btn btn-outline btn-sm" style={{ color: "var(--red)" }} onClick={async () => { if (window.confirm("Delete this concept map?")) { await api.delete(`/admin/weekly/maps/${m.id}`).catch(err); reload(); } }}>Delete</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Brain teasers ─────────
function TeasersTab() {
  const [list, setList] = useState([]);
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/weekly/teasers").then((r) => { setList(r.data.teasers); setToday(r.data.today); }).catch(err);
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true);
    try { const { data } = await api.post("/admin/weekly/teasers/generate", { count: 10 }); alert(`${data.created} new drafts. Check each one, then Approve.`); load(); }
    catch (e) { err(e); }
    setBusy(false);
  };
  const scheduled = list.filter((t) => t.status === "approved" && t.publish_on > today).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-blue" disabled={busy} onClick={generate}>{busy ? "AI is writing… (about 40 s)" : "Generate 10 teasers"}</button>
        <span style={{ fontSize: 14, color: "var(--text2)" }}>{scheduled} approved and waiting · Class 6–8 science · answer revealed the next day at 7 PM</span>
      </div>
      {list.length === 0 && <p style={{ color: "var(--text3)" }}>No teasers yet. Press Generate.</p>}
      {list.map((t) => <TeaserRow key={t.id} t={t} today={today} reload={load} />)}
    </div>
  );
}

function TeaserRow({ t, today, reload }) {
  const [d, setD] = useState(t.data);
  const [date, setDate] = useState(t.publish_on || "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setD(t.data); setDate(t.publish_on || ""); setDirty(false); }, [t]);
  const b = badge(t.status, t.publish_on, today);
  const upd = (patch) => { setD({ ...d, ...patch }); setDirty(true); };
  const save = async (patch) => {
    try { await api.put(`/admin/weekly/teasers/${t.id}`, { data: d, ...patch }); reload(); } catch (e) { err(e); }
  };

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" style={{ maxWidth: 260, fontWeight: 800 }} value={d.title} onChange={(e) => upd({ title: e.target.value })} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {t.players > 0 && <span style={{ fontSize: 12, color: "var(--text2)" }}>{t.players} answered · {Math.round((t.correct / t.players) * 100)}% right</span>}
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 10, background: b.bg, color: b.fg }}>{b.text}</span>
        </div>
      </div>
      {d.clues.map((c, i) => (
        <input key={i} className="form-input" value={c} onChange={(e) => upd({ clues: d.clues.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Clue ${i + 1}`} />
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {d.options.map((o, i) => (
          <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 10, border: `2px solid ${d.answer === i ? "var(--green)" : "var(--gray3)"}` }}>
            <input type="radio" name={`ans-${t.id}`} checked={d.answer === i} onChange={() => upd({ answer: i })} aria-label={`Option ${"ABCD"[i]} is correct`} />
            <strong>{"ABCD"[i]}.</strong>
            <input className="form-input" style={{ border: "none", padding: 4 }} value={o} onChange={(e) => upd({ options: d.options.map((x, j) => (j === i ? e.target.value : x)) })} />
          </label>
        ))}
      </div>
      <textarea className="form-input" rows={2} value={d.explanation} onChange={(e) => upd({ explanation: e.target.value })} placeholder="Why this is the answer (shown at the reveal)" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {dirty && <button className="btn btn-blue btn-sm" onClick={() => save({})}>Save changes</button>}
        {t.status === "draft"
          ? <button className="btn btn-blue btn-sm" onClick={() => save({ status: "approved", publishOn: date || undefined })}>Approve{date ? ` for ${fmtDay(date)}` : " (next free Wednesday)"}</button>
          : <button className="btn btn-outline btn-sm" onClick={() => save({ status: "draft" })}>Unpublish</button>}
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Date
          <input type="date" className="form-input" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {t.status === "approved" && date && date !== (t.publish_on || "") && <button className="btn btn-outline btn-sm" onClick={() => save({ publishOn: date })}>Move to {fmtDay(date)}</button>}
        <button className="btn btn-outline btn-sm" onClick={() => drawTeaserPost({ ...d, id: t.id })}>Download post image</button>
        <button className="btn btn-outline btn-sm" style={{ color: "var(--red)" }} onClick={async () => { if (window.confirm("Delete this teaser?")) { await api.delete(`/admin/weekly/teasers/${t.id}`).catch(err); reload(); } }}>Delete</button>
      </div>
    </div>
  );
}
