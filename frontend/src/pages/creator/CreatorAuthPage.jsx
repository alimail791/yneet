import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import creatorApi, { CREATOR_TOKEN, errMsg } from "../../lib/creatorApi";

const SUBJECTS = ["Biology", "Chemistry", "Physics"];
const LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"];

function Toggle({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}
            className="chip" style={{ cursor: "pointer", border: "none", padding: "6px 12px", fontSize: 13, background: on ? "var(--blue-mid)" : "var(--gray2)", color: on ? "#fff" : "var(--text2)" }}>
            {on ? "✓ " : ""}{o}
          </button>
        );
      })}
    </div>
  );
}

// /creator/apply and /creator/login — teachers who make YNeet Shorts.
export default function CreatorAuthPage({ mode }) {
  const navigate = useNavigate();
  const isApply = mode === "apply";
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", youtubeUrl: "", instagramUrl: "", subjects: [], languages: ["English"], bio: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isApply && !form.subjects.length) { setError("Pick at least one subject you teach."); return; }
    setBusy(true);
    try {
      const { data } = await creatorApi.post(isApply ? "/creator/apply" : "/creator/login",
        isApply ? form : { email: form.email, password: form.password });
      try { localStorage.setItem(CREATOR_TOKEN, data.token); } catch { /* storage unavailable */ }
      navigate("/creator", { replace: true });
    } catch (err) {
      setError(errMsg(err, isApply ? "Couldn't send your application" : "Couldn't log in"));
    }
    setBusy(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">YNeet Creators</div>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 18 }}>
          {isApply
            ? "Make 3–5 minute NEET concept Shorts. Get paid for every approved video, every week — and get your channel in front of thousands of NEET students."
            : "Log in to submit Shorts and see your earnings."}
        </p>

        {isApply && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
            {[["💰", "Paid weekly", "per approved Short"], ["📣", "Your channel", "credited on every video"], ["🌟", "Get featured", "on the yneet.in homepage"]].map(([i, t, d]) => (
              <div key={t} style={{ background: "var(--gray2)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{i}</div>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.3 }}>{d}</div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit}>
          {isApply && (
            <div className="form-group"><label className="form-label">Your name (shown on your Shorts)</label>
              <input className="form-input" required value={form.name} onChange={set("name")} placeholder="Priya Raman" /></div>
          )}
          <div className="form-group"><label className="form-label">Email</label>
            <input className="form-input" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="priya@gmail.com" /></div>
          {isApply && (
            <div className="form-group"><label className="form-label">WhatsApp number</label>
              <input className="form-input" required inputMode="numeric" value={form.phone} onChange={set("phone")} placeholder="98765 43210" /></div>
          )}
          <div className="form-group"><label className="form-label">Password{isApply && <span className="optional-tag">at least 8 characters</span>}</label>
            <input className="form-input" type="password" required minLength={isApply ? 8 : undefined} autoComplete={isApply ? "new-password" : "current-password"} value={form.password} onChange={set("password")} /></div>

          {isApply && (
            <>
              <div className="form-group"><label className="form-label">Subjects you teach</label><Toggle options={SUBJECTS} value={form.subjects} onChange={v => setForm(f => ({ ...f, subjects: v }))} /></div>
              <div className="form-group"><label className="form-label">Languages you can teach in</label><Toggle options={LANGUAGES} value={form.languages} onChange={v => setForm(f => ({ ...f, languages: v }))} /></div>
              <div className="form-group"><label className="form-label">YouTube channel<span className="optional-tag">optional</span></label>
                <input className="form-input" value={form.youtubeUrl} onChange={set("youtubeUrl")} placeholder="youtube.com/@yourchannel" /></div>
              <div className="form-group"><label className="form-label">Instagram<span className="optional-tag">optional</span></label>
                <input className="form-input" value={form.instagramUrl} onChange={set("instagramUrl")} placeholder="instagram.com/yourhandle" /></div>
              <div className="form-group"><label className="form-label">About you<span className="optional-tag">optional</span></label>
                <textarea className="form-input" style={{ minHeight: 60 }} value={form.bio} onChange={set("bio")} placeholder="Biology teacher, 6 years coaching NEET students in Chennai" /></div>
            </>
          )}

          {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-blue btn-full" disabled={busy} style={{ padding: "12px 0" }}>
            {busy ? "Please wait…" : isApply ? "Apply to become a creator" : "Log in"}
          </button>
        </form>

        <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 16 }}>
          {isApply ? <>Already applied? <Link to="/creator/login" style={{ color: "var(--blue-mid)", fontWeight: 700 }}>Log in</Link></>
            : <>New here? <Link to="/creator/apply" style={{ color: "var(--blue-mid)", fontWeight: 700 }}>Apply to become a creator</Link><br />Forgot your password? Message YNeet on WhatsApp.</>}
        </p>
      </div>
    </div>
  );
}
