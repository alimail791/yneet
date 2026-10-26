import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import creatorApi, { CREATOR_TOKEN, errMsg } from "../../lib/creatorApi";
import { CURRICULUM } from "../../utils/curriculum";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper", "All"];
const SUBJECTS = ["Biology", "Chemistry", "Physics"];
const LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada", "Bengali", "Marathi"];
const emptyShort = { title: "", description: "", subject: "Biology", classLevel: "12th", chapter: "", language: "English", videoLink: "", durationMin: "" };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const shareUrl = (id) => `${window.location.origin}/s/${id}`;

function videoLinkOf(s) {
  if (s.provider === "youtube") return `https://youtu.be/${s.videoRef}`;
  if (s.provider === "bunny") return `https://iframe.mediadelivery.net/embed/${s.videoRef}`;
  return s.videoRef;
}
function chaptersFor(classLevel, subject) {
  if (classLevel === "All") return [...new Set(Object.values(CURRICULUM).flatMap(c => c[subject] || []))];
  return CURRICULUM[classLevel]?.[subject] || [];
}

const STATUS = {
  pending: { label: "In review", cls: "chip-amber" },
  approved: { label: "Live", cls: "chip-green" },
  rejected: { label: "Needs changes", cls: "chip-red" },
};

// Shown until the creator types the 6-digit code we emailed at sign-up.
function VerifyEmailCard({ email, onVerified }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const verify = async (e) => {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true);
    try { const { data } = await creatorApi.post("/creator/verify-email", { code }); onVerified(data.creator); }
    catch (x) { setErr(errMsg(x, "Couldn't check the code")); }
    setBusy(false);
  };
  const resend = async () => {
    setErr(""); setMsg("");
    try { const { data } = await creatorApi.post("/creator/verify-email/send"); setMsg(data.message || "Code sent"); }
    catch (x) { setErr(errMsg(x, "Couldn't send the email")); }
  };
  return (
    <div className="card mb-4" style={{ background: "var(--blue-light)", borderColor: "var(--blue-light)" }}>
      <strong style={{ color: "var(--blue)" }}>📧 Confirm your email</strong>
      <p style={{ fontSize: 13.5, color: "var(--text2)", marginTop: 4 }}>
        We sent a 6-digit code to <strong>{email}</strong>. Enter it to finish signing up. Check your spam folder if you can't see it.
      </p>
      <form onSubmit={verify} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        <input className="form-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ width: 150, letterSpacing: 4, fontWeight: 700 }} />
        <button className="btn btn-blue" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={resend}>Send a new code</button>
      </form>
      {msg && <p style={{ fontSize: 13, color: "var(--green)", marginTop: 8 }}>{msg}</p>}
      {err && <p style={{ fontSize: 13, color: "var(--red)", marginTop: 8 }}>{err}</p>}
    </div>
  );
}

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [shorts, setShorts] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [tab, setTab] = useState("shorts");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // "new" | short id
  const [form, setForm] = useState(emptyShort);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileMsg, setProfileMsg] = useState("");
  const [toast, setToast] = useState("");

  const load = async () => {
    try {
      const [m, s, p] = await Promise.all([creatorApi.get("/creator/me"), creatorApi.get("/creator/shorts"), creatorApi.get("/creator/payouts")]);
      setMe(m.data.creator); setStats(m.data.stats); setShorts(s.data.shorts); setPayouts(p.data.payouts);
      setProfile(p0 => p0 || { ...m.data.creator, subjects: m.data.creator.subjects.join(", "), languages: m.data.creator.languages.join(", "), currentPassword: "", newPassword: "" });
    } catch { /* 401 handled by the client */ }
    setLoading(false);
  };
  useEffect(() => {
    let has = false;
    try { has = !!localStorage.getItem(CREATOR_TOKEN); } catch { /* ignore */ }
    if (!has) { navigate("/creator/login", { replace: true }); return; }
    load();
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const logout = () => { try { localStorage.removeItem(CREATOR_TOKEN); } catch { /* ignore */ } navigate("/creator/login", { replace: true }); };

  const openNew = () => { setForm({ ...emptyShort, language: me?.languages?.[0] || "English", subject: me?.subjects?.[0] || "Biology" }); setFormError(""); setModal("new"); };
  const openEdit = (s) => {
    setForm({ title: s.title, description: s.description || "", subject: s.subject, classLevel: s.classLevel, chapter: s.chapter, language: s.language, videoLink: videoLinkOf(s), durationMin: s.durationSec ? String(Math.round(s.durationSec / 6) / 10) : "" });
    setFormError(""); setModal(s.id);
  };
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const saveShort = async () => {
    setSaving(true); setFormError("");
    const { durationMin, ...rest } = form;
    const payload = { ...rest, durationSec: durationMin === "" ? null : Math.round(Number(durationMin) * 60) };
    try {
      if (modal === "new") await creatorApi.post("/creator/shorts", payload);
      else await creatorApi.put(`/creator/shorts/${modal}`, payload);
      setModal(null); flash(modal === "new" ? "Sent for review" : "Updated and sent for review again"); load();
    } catch (err) { setFormError(errMsg(err, "Couldn't save")); }
    setSaving(false);
  };

  const removeShort = async (s) => {
    if (!window.confirm(`Withdraw "${s.title}"?`)) return;
    try { await creatorApi.delete(`/creator/shorts/${s.id}`); load(); } catch (err) { alert(errMsg(err)); }
  };

  const share = async (s) => {
    const url = shareUrl(s.id);
    const text = `Learn "${s.title}" in a few minutes — my new Short on YNeet 🎬`;
    try {
      if (navigator.share) { await navigator.share({ title: s.title, text, url }); return; }
    } catch { return; /* cancelled */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };
  const copy = async (s) => {
    try { await navigator.clipboard.writeText(shareUrl(s.id)); flash("Link copied"); } catch { window.prompt("Copy this link:", shareUrl(s.id)); }
  };

  const saveProfile = async () => {
    setProfileMsg("");
    try {
      const { data } = await creatorApi.put("/creator/me", profile);
      setMe(data.creator);
      setProfile(p => ({ ...p, currentPassword: "", newPassword: "" }));
      setProfileMsg("Saved");
    } catch (err) { setProfileMsg(errMsg(err, "Couldn't save")); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!me) return null;

  const approved = me.status === "approved";
  const setP = (k) => (e) => setProfile(p => ({ ...p, [k]: e.target.value }));
  const tabBtn = (k, label) => (
    <button key={k} className={`nav-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)} style={{ fontSize: 14, padding: "7px 14px" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <nav className="app-nav">
        <div className="nav-logo">YNeet Creators</div>
        <div className="nav-right">
          <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>{me.name.split(" ")[0]}</span>
          <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-content" style={{ maxWidth: 960 }}>
        {me.emailVerified === false && <VerifyEmailCard email={me.email} onVerified={(c) => { setMe(c); flash("Email confirmed ✓"); }} />}

        {me.status === "pending" && (
          <div className="card mb-4" style={{ background: "var(--amber-light)", borderColor: "var(--amber-light)" }}>
            <strong style={{ color: "var(--amber)" }}>⏳ Your application is being reviewed</strong>
            <p style={{ fontSize: 13.5, color: "var(--text2)", marginTop: 4 }}>
              YNeet will message you on WhatsApp ({me.phone}) once you're approved — usually within 2 days. Meanwhile, fill in your profile and payout details.
            </p>
          </div>
        )}

        <div className="grid4 mb-4">
          <div className="card"><div className="card-title">Live Shorts</div><div className="card-value">{stats.approved}</div><div className="card-sub">{stats.pending} in review</div></div>
          <div className="card"><div className="card-title">Students reached</div><div className="card-value">{stats.viewers.toLocaleString("en-IN")}</div><div className="card-sub">unique viewers</div></div>
          <div className="card"><div className="card-title">To be paid</div><div className="card-value" style={{ color: "var(--green)" }}>{inr(stats.unpaidAmount)}</div><div className="card-sub">{stats.unpaidShorts} Short{stats.unpaidShorts === 1 ? "" : "s"} · paid weekly</div></div>
          <div className="card"><div className="card-title">Paid so far</div><div className="card-value">{inr(stats.paidTotal)}</div><div className="card-sub">{inr(me.ratePerVideo)} per approved Short</div></div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4 }}>{tabBtn("shorts", "My Shorts")}{tabBtn("earnings", "Earnings")}{tabBtn("profile", "Profile")}</div>
          {tab === "shorts" && <button className="btn btn-blue" onClick={openNew} disabled={!approved} title={approved ? "" : "Available once you're approved"}>+ Submit a Short</button>}
        </div>

        {tab === "shorts" && (
          <>
            <div className="card mb-4" style={{ background: "var(--blue-light)", borderColor: "var(--blue-light)", fontSize: 13.5, color: "var(--text2)" }}>
              <strong style={{ color: "var(--blue)" }}>How it works:</strong> upload your video to YouTube as <strong>Unlisted</strong> (or Bunny Stream), then submit the link here.
              YNeet reviews it, adds quick-check questions and puts it live. You're paid for every approved Short each week.
              The best ones get <strong>featured</strong> on the yneet.in homepage with a link to your channel — and you get a share link to promote them.
            </div>
            {shorts.length === 0 ? (
              <div className="card text-center" style={{ padding: 40 }}>
                <div style={{ fontSize: 40 }}>🎬</div>
                <p style={{ fontWeight: 700, marginTop: 6 }}>Submit your first Short</p>
                <p style={{ fontSize: 13.5, color: "var(--text2)" }}>One concept, 3–5 minutes, clear audio. Phone recording is fine.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {shorts.map(s => (
                  <div key={s.id} className="card" style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span className={`chip ${STATUS[s.reviewStatus].cls}`}>{STATUS[s.reviewStatus].label}</span>
                        {s.isFeatured && <span className="chip chip-purple">🌟 Featured</span>}
                        <span className="chip" style={{ background: "var(--gray2)", color: "var(--text2)" }}>{s.subject} · {s.classLevel} · {s.language}</span>
                      </div>
                      <a href={videoLinkOf(s)} target="_blank" rel="noreferrer" style={{ fontWeight: 800, fontSize: 15 }}>{s.title}</a>
                      <p style={{ fontSize: 12.5, color: "var(--text3)" }}>{s.chapter} · submitted {fmt(s.submittedAt)}</p>
                      {s.reviewStatus === "rejected" && s.reviewNote && <p style={{ fontSize: 13, color: "var(--red)", marginTop: 4 }}>Feedback: {s.reviewNote}</p>}
                    </div>
                    <div style={{ textAlign: "right", fontSize: 13, color: "var(--text2)" }}>
                      {s.reviewStatus === "approved" && (
                        <>
                          <div><strong>{s.viewCount}</strong> viewers</div>
                          <div>{inr(s.payAmount)} · {s.payout?.status === "paid" ? <span style={{ color: "var(--green)", fontWeight: 700 }}>paid</span> : s.payout ? "in this week's payout" : "to be paid"}</div>
                        </>
                      )}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                        {s.isFeatured && <><button className="btn btn-green btn-sm" onClick={() => share(s)}>Share</button><button className="btn btn-outline btn-sm" onClick={() => copy(s)}>Copy link</button></>}
                        {s.reviewStatus !== "approved" && <><button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button><button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => removeShort(s)}>Withdraw</button></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "earnings" && (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="admin-table">
              <thead><tr><th>Week ending</th><th>Shorts</th><th>Amount</th><th>Bonus</th><th>Status</th></tr></thead>
              <tbody>
                {payouts.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>Payouts are created every Monday for the Shorts approved the week before.</td></tr>}
                {payouts.map(p => (
                  <tr key={p.id}>
                    <td>{fmt(new Date(new Date(p.periodEnd).getTime() - 1))}</td>
                    <td>{p.videoCount}</td>
                    <td>{inr(p.amount)}</td>
                    <td>{p.bonus ? inr(p.bonus) : "—"}</td>
                    <td>{p.status === "paid"
                      ? <span className="chip chip-green">Paid {fmt(p.paidAt)}{p.reference ? ` · ${p.reference}` : ""}</span>
                      : <span className="chip chip-amber">Processing</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12.5, color: "var(--text3)", padding: "10px 14px" }}>
              Payments go to your UPI ID{me.upiId ? ` (${me.upiId})` : " — add it in your Profile"}.
            </p>
          </div>
        )}

        {tab === "profile" && profile && (
          <div className="card" style={{ maxWidth: 560 }}>
            <div className="form-group"><label className="form-label">Name (shown on your Shorts)</label><input className="form-input" value={profile.name} onChange={setP("name")} /></div>
            <div className="form-group"><label className="form-label">WhatsApp number</label><input className="form-input" value={profile.phone} onChange={setP("phone")} /></div>
            <div className="form-group"><label className="form-label">UPI ID for payouts</label><input className="form-input" value={profile.upiId || ""} onChange={setP("upiId")} placeholder="priya@okaxis" /></div>
            <div className="form-group"><label className="form-label">YouTube channel</label><input className="form-input" value={profile.youtubeUrl || ""} onChange={setP("youtubeUrl")} placeholder="youtube.com/@yourchannel" /></div>
            <div className="form-group"><label className="form-label">Instagram</label><input className="form-input" value={profile.instagramUrl || ""} onChange={setP("instagramUrl")} placeholder="instagram.com/yourhandle" /></div>
            <div className="form-group"><label className="form-label">Subjects (comma separated)</label><input className="form-input" value={profile.subjects} onChange={setP("subjects")} /></div>
            <div className="form-group"><label className="form-label">Languages (comma separated)</label><input className="form-input" value={profile.languages} onChange={setP("languages")} /></div>
            <div className="form-group"><label className="form-label">About you</label><textarea className="form-input" style={{ minHeight: 60 }} value={profile.bio || ""} onChange={setP("bio")} /></div>
            <p style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 8px" }}>Change password</p>
            <div className="grid2 mb-4">
              <input className="form-input" type="password" placeholder="Current password" value={profile.currentPassword} onChange={setP("currentPassword")} />
              <input className="form-input" type="password" placeholder="New password" value={profile.newPassword} onChange={setP("newPassword")} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="btn btn-blue" onClick={saveProfile}>Save profile</button>
              {profileMsg && <span style={{ fontSize: 13, color: profileMsg === "Saved" ? "var(--green)" : "var(--red)" }}>{profileMsg}</span>}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="admin-modal-backdrop" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>{modal === "new" ? "Submit a Short" : "Edit and resubmit"}</h2>
            <label className="form-label">Video link</label>
            <input className="form-input" style={{ marginBottom: 4 }} value={form.videoLink} onChange={setF("videoLink")} placeholder="https://youtu.be/…" />
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 12 }}>Upload to YouTube as <strong>Unlisted</strong>, then paste the link.</p>
            <label className="form-label">Title</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.title} onChange={setF("title")} placeholder="Mitosis in 4 minutes" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
              <div><label className="form-label">Subject</label><select className="form-select" value={form.subject} onChange={setF("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="form-label">Class</label><select className="form-select" value={form.classLevel} onChange={setF("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="form-label">Language</label><select className="form-select" value={form.language} onChange={setF("language")}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
            </div>
            <label className="form-label">Chapter</label>
            <input className="form-input" style={{ marginBottom: 12 }} list="creator-chapters" value={form.chapter} onChange={setF("chapter")} placeholder="Pick or type a chapter" />
            <datalist id="creator-chapters">{chaptersFor(form.classLevel, form.subject).map(c => <option key={c} value={c} />)}</datalist>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 12 }}>
              <div><label className="form-label">Length (min)</label><input className="form-input" type="number" min="0" step="0.5" value={form.durationMin} onChange={setF("durationMin")} placeholder="4" /></div>
              <div><label className="form-label">One line about it<span className="optional-tag">optional</span></label><input className="form-input" value={form.description} onChange={setF("description")} /></div>
            </div>
            {formError && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{formError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-blue" onClick={saveShort} disabled={saving || !form.title || !form.videoLink || !form.chapter}>{saving ? "Sending…" : "Send for review"}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="shorts-toast">{toast}</div>}
    </div>
  );
}
