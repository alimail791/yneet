// Ask YNeet: send a doubt (text and/or photo); a teacher answers, usually within
// 24 hours. Below: your doubts and this week's featured "Ask YNeet Friday" answers.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

const ink = "#3b2fc9";
const ago = (iso) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 1 ? "just now" : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

// Shrink a phone photo to ≤1280 px JPEG so it uploads fast and stays small.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.72));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function AskPage() {
  const [data, setData] = useState(null);
  const [subject, setSubject] = useState("Biology");
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);

  const load = () => api.get("/ask").then((r) => setData(r.data)).catch(() => setData({ mine: [], featured: [], canAsk: false, left: 0, subjects: [] }));
  useEffect(() => { load(); }, []);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setImage(await shrink(f)); } catch { setMsg("Couldn't read that photo. Try another one."); }
    e.target.value = "";
  };

  const send = async () => {
    setSending(true); setMsg("");
    try {
      await api.post("/ask", { subject, question, image });
      setQuestion(""); setImage(null);
      setMsg("Sent! A teacher will answer soon, usually within 24 hours. We'll notify you.");
      try { window.gtag?.("event", "doubt_sent", { subject }); } catch { /* ignore */ }
      load();
    } catch (e) { setMsg(e?.response?.data?.message || "Couldn't send. Please try again."); }
    setSending(false);
  };

  if (!data) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "18px 16px 40px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "grid", gap: 14 }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← Home</Link>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Ask YNeet</h1>
          <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.5 }}>Stuck on a doubt? Ask it here. A teacher answers, usually within 24 hours, and the best doubts are explained every Friday.</p>
        </div>

        {data.canAsk ? (
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.subjects.map((s) => (
                <button key={s} onClick={() => setSubject(s)}
                  style={{ height: 40, padding: "0 14px", borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: "pointer", border: `2px solid ${subject === s ? ink : "var(--gray3)"}`, background: subject === s ? ink : "#fff", color: subject === s ? "#fff" : "var(--text)" }}>{s}</button>
              ))}
            </div>
            <label htmlFor="doubt" style={{ fontWeight: 700, fontSize: 14 }}>Your doubt</label>
            <textarea id="doubt" className="form-input" rows={4} maxLength={1500} value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Why is the ascending limb of Henle's loop impermeable to water?" />
            {image && (
              <div style={{ position: "relative", width: 120 }}>
                <img src={image} alt="Your photo" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid var(--gray3)" }} />
                <button onClick={() => setImage(null)} aria-label="Remove photo" style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 14, border: "none", background: "#0f172a", color: "#fff", cursor: "pointer" }}>×</button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={pickPhoto} />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: "center", height: 48 }} onClick={() => fileRef.current?.click()}>{image ? "Change photo" : "Add photo"}</button>
              <button className="btn btn-blue" style={{ flex: 1, justifyContent: "center", height: 48, background: ink }} disabled={sending || data.left <= 0 || (!question.trim() && !image)} onClick={send}>
                {sending ? "Sending…" : "Send doubt"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text3)" }}>{data.left > 0 ? `You can send ${data.left} more today.` : "You've sent 3 doubts today. Send more tomorrow."}</p>
            {msg && <p style={{ fontSize: 14, color: msg.startsWith("Sent") ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{msg}</p>}
          </div>
        ) : (
          <div className="card"><p style={{ fontSize: 14, color: "var(--text2)" }}>Asking doubts is part of an active YNeet plan. You can still read this week's answers below.</p></div>
        )}

        {data.mine.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ fontWeight: 800 }}>My doubts</p>
            {data.mine.map((d) => (
              <div key={d.id} className="card" style={{ display: "grid", gap: 6 }}>
                <button onClick={() => setOpen(open === d.id ? null : d.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", display: "grid", gap: 4 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "#4c1d95" }}>{d.subject} · {ago(d.created_at)}</span>
                    <span style={{ fontWeight: 700, color: d.status === "answered" ? "var(--green)" : d.status === "rejected" ? "var(--red)" : "#92400e" }}>
                      {d.status === "answered" ? (d.seen_at ? "Answered" : "New answer") : d.status === "rejected" ? "Not answered" : "Waiting for teacher"}
                    </span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{d.question}{d.has_image ? " 📷" : ""}</span>
                </button>
                {(open === d.id || (d.status !== "pending" && !d.seen_at)) && d.status === "answered" && (
                  <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line", background: "var(--green-light)", padding: 12, borderRadius: 12, color: "#064e3b" }}>{d.answer}</p>
                )}
                {d.status === "rejected" && d.note && <p style={{ fontSize: 13, color: "var(--text2)" }}>{d.note}</p>}
              </div>
            ))}
          </div>
        )}

        {data.featured.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ fontWeight: 800 }}>Ask YNeet Friday</p>
            {data.featured.map((d) => (
              <div key={d.id} className="card" style={{ display: "grid", gap: 8, background: "#fffbeb", borderColor: "#fde68a" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>{d.subject}{d.cls ? ` · asked by a Class ${String(d.cls).replace(/th$/, "")} student` : ""}</span>
                <p style={{ fontWeight: 700 }}>{d.question}</p>
                <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line", color: "var(--text2)" }}>{d.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
