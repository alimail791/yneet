// Admin → Doubts (Ask YNeet). Oldest waiting doubts first. Each has an AI draft:
// check it, edit, and Send. Then feature good ones on a Friday (app, website
// and a downloadable channel post).
import { useEffect, useState } from "react";
import api from "../../lib/api";
import { drawDoubtPost } from "../../utils/postImage";

const TABS = [["pending", "Waiting"], ["answered", "Answered"], ["featured", "Featured"], ["rejected", "Not answered"]];
const ago = (iso) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 1 ? "just now" : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};
const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const err = (e) => alert(e?.response?.data?.message || e.message || "Something went wrong");

export default function AdminDoubtsPage() {
  const [tab, setTab] = useState("pending");
  const [data, setData] = useState(null);
  const load = () => api.get(`/admin/doubts?status=${tab}`).then((r) => setData(r.data)).catch(err);
  useEffect(() => { setData(null); load(); }, [tab]);
  // While AI drafts are being written, refresh every 10 s.
  useEffect(() => {
    if (!data?.doubts?.some((d) => d.status === "pending" && !d.ai_draft)) return;
    const t = setTimeout(load, 10000);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Ask YNeet: doubts</h1>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>
        AI drafts every answer. Check it (the student only sees what you send), edit if needed, and press Send. Students get a notification.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={tab === k ? "btn btn-blue" : "btn btn-outline"} onClick={() => setTab(k)}>
            {l}{data?.counts?.[k] !== undefined && k !== "featured" ? ` (${data.counts[k]})` : ""}
          </button>
        ))}
      </div>
      {!data && <div className="spinner" />}
      {data && data.doubts.length === 0 && <p style={{ color: "var(--text3)" }}>{tab === "pending" ? "No doubts waiting. 🎉" : "Nothing here yet."}</p>}
      <div style={{ display: "grid", gap: 14 }}>
        {data?.doubts.map((d) => <DoubtCard key={d.id} d={d} today={data.today} reload={load} />)}
      </div>
    </div>
  );
}

function DoubtCard({ d, today, reload }) {
  const [answer, setAnswer] = useState(d.answer || d.ai_draft || "");
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(d.featured_on || "");
  useEffect(() => { setAnswer(d.answer || d.ai_draft || ""); setDate(d.featured_on || ""); }, [d.id, d.ai_draft, d.answer, d.featured_on]);
  const notDoubt = (d.ai_draft || "").startsWith("NOT A STUDY DOUBT");

  const act = async (fn) => { setBusy(true); try { await fn(); reload(); } catch (e) { err(e); } setBusy(false); };

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--text2)" }}>
        <span><strong style={{ color: "var(--text)" }}>{d.name || "Student"}</strong> · {d.cls || "class ?"} · {d.subject} · {ago(d.created_at)}{d.phone ? ` · ${d.phone}` : ""}</span>
        {d.featured_on && <span style={{ fontWeight: 700, color: "#92400e" }}>Featured {fmtDay(d.featured_on)}{d.featured_on <= today ? " (live)" : ""}</span>}
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, whiteSpace: "pre-line" }}>{d.question}</p>
      {d.has_image && (img
        ? <img src={img} alt="Student's photo" style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 12, border: "1px solid var(--gray3)", justifySelf: "start" }} />
        : <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => api.get(`/ask/${d.id}/image`).then((r) => setImg(r.data.image)).catch(err)}>Show photo</button>)}

      {d.status === "pending" && !d.ai_draft && <p style={{ fontSize: 13, color: "var(--text3)" }}>AI is writing a draft…</p>}
      {notDoubt && <p style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>AI thinks this isn't a study doubt.</p>}
      {(d.status !== "pending" || d.ai_draft) && d.status !== "rejected" && (
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700 }}>
          {d.status === "pending" ? "Answer (AI draft, check before sending)" : "Answer sent"}
          <textarea className="form-input" rows={8} value={notDoubt && !d.answer ? "" : answer} onChange={(e) => setAnswer(e.target.value)} style={{ fontWeight: 400, lineHeight: 1.5 }} />
        </label>
      )}
      {d.status === "rejected" && <p style={{ fontSize: 13, color: "var(--text2)" }}>Told the student: {d.note}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {d.status !== "rejected" && (
          <button className="btn btn-blue btn-sm" disabled={busy || answer.trim().length < 5} onClick={() => act(() => api.post(`/admin/doubts/${d.id}/answer`, { answer }))}>
            {d.status === "answered" ? "Update answer" : "Send answer"}
          </button>
        )}
        {d.status === "pending" && (
          <>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act(() => api.post(`/admin/doubts/${d.id}/redraft`))}>New AI draft</button>
            <button className="btn btn-outline btn-sm" disabled={busy} style={{ color: "var(--red)" }}
              onClick={() => { const note = window.prompt("Tell the student why (they'll see this):", "This doesn't look like a study doubt. Please send a Physics, Chemistry or Biology question."); if (note) act(() => api.post(`/admin/doubts/${d.id}/reject`, { note })); }}>
              Not a doubt
            </button>
          </>
        )}
        {d.status === "answered" && (
          <>
            {!d.featured_on
              ? <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act(() => api.post(`/admin/doubts/${d.id}/feature`, { date: date || undefined }))}>Feature{date ? ` on ${fmtDay(date)}` : " (next free Friday)"}</button>
              : <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act(() => api.post(`/admin/doubts/${d.id}/feature`, { date: null }))}>Remove feature</button>}
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Date
              <input type="date" className="form-input" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {d.featured_on && date && date !== d.featured_on && <button className="btn btn-outline btn-sm" onClick={() => act(() => api.post(`/admin/doubts/${d.id}/feature`, { date }))}>Move to {fmtDay(date)}</button>}
            <button className="btn btn-outline btn-sm" onClick={() => drawDoubtPost({ ...d, answer })}>Download post image</button>
          </>
        )}
      </div>
    </div>
  );
}
