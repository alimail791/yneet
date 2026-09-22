import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const SUBJECTS = ["Physics","Chemistry","Biology","Thermodynamics","Optics","Electrostatics","Magnetism","Modern Physics","Organic Chemistry","Inorganic Chemistry","Physical Chemistry","Coordination Compounds","Electrochemistry","Genetics","Cell Biology","Human Physiology","Plant Physiology","Ecology","Evolution","Biotechnology"];
const NEET_DATES = [
  { value:"2025-05-04", label:"NEET 2025 — May 4, 2025" },
  { value:"2026-05-03", label:"NEET 2026 — May 3, 2026" },
  { value:"2027-05-02", label:"NEET 2027 — May 2, 2027" },
];

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const p = user?.profile || {};
  const [form, setForm] = useState({
    name: user?.name || "",
    targetScore: p.targetScore || 650, currentScore: p.currentScore || 0,
    examYear: p.examYear || 2026, neetDate: p.neetDate || user?.neetDate || "2026-05-03",
    studyHoursPerDay: p.studyHoursPerDay || 6,
    weakSubjects: p.weakSubjects || [], strongSubjects: p.strongSubjects || [],
    phone: p.phone || user?.phone || "", gender: p.gender || user?.gender || "",
    place: p.place || user?.place || "", parentEmail: p.parentEmail || "",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const toggleSubj = (arr, s) => {
    const current = form[arr];
    setForm({ ...form, [arr]: current.includes(s) ? current.filter(x => x !== s) : [...current, s] });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/user/profile", { ...form, targetScore: parseInt(form.targetScore), currentScore: parseInt(form.currentScore), examYear: parseInt(form.neetDate?.split("-")[0]) || 2026, studyHoursPerDay: parseFloat(form.studyHoursPerDay) });
      updateUser({ name: form.name, phone: form.phone, gender: form.gender, place: form.place, neetDate: form.neetDate, profile: { ...p, ...form } });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert("Failed to save. Try again."); }
    setSaving(false);
  };

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const LEVEL_NAMES = ["","Beginner","Explorer","Learner","Achiever","Scholar","Expert","Champion","Master","Elite","Legend"];

  return (
    <div>
      <div className="section-title mb-5">My Profile</div>
      <div className="card mb-5">
        {/* Avatar row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--gray3)" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg,var(--blue-mid),var(--purple))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: "var(--text2)" }}>{user?.email}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(() => {
                const sub = user?.subscription;
                const isActive = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date();
                if (!isActive) return <span className="chip" style={{ background: "var(--gray2)", color: "var(--text3)" }}>No Active Plan</span>;
                const label = sub.plan === "TRIAL_5D" ? "5-Day Trial" : sub.plan === "MONTHLY" ? "Monthly Plan" : "Active Plan";
                const endStr = new Date(sub.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                return <span className="chip chip-green">{label} · till {endStr}</span>;
              })()}
              <span className="chip chip-purple">Level {user?.xp?.level || 1} · {LEVEL_NAMES[user?.xp?.level || 1]}</span>
              <span className="chip chip-amber">🔥 {user?.streak?.current || 0} streak</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="grid2 mb-5">
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={set("name")} /></div>
          <div className="form-group">
            <label className="form-label">Class</label>
            <div className="form-input" style={{ display: "flex", alignItems: "center", background: "var(--gray2)", color: "var(--text2)", cursor: "not-allowed" }}>
              {p.class === "Dropper" ? "Dropper / Repeater" : p.class ? `Class ${p.class.replace("th", "")}` : "—"}
            </div>
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Set at registration on YNeet — contact support to change your class.</p>
          </div>
          <div className="form-group">
            <label className="form-label">NEET Exam Date</label>
            <select className="form-select" value={form.neetDate} onChange={set("neetDate")}>
              {NEET_DATES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Target Score</label><input className="form-input" type="number" min="100" max="720" value={form.targetScore} onChange={set("targetScore")} /></div>
          <div className="form-group"><label className="form-label">Current Score</label><input className="form-input" type="number" min="0" max="720" value={form.currentScore} onChange={set("currentScore")} /></div>
          <div className="form-group"><label className="form-label">Study Hours / Day</label><input className="form-input" type="number" min="1" max="16" step="0.5" value={form.studyHoursPerDay} onChange={set("studyHoursPerDay")} /></div>
          <div className="form-group">
            <label className="form-label">Gender <span className="optional-tag">(optional)</span></label>
            <select className="form-select" value={form.gender} onChange={set("gender")}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Phone <span className="optional-tag">(optional)</span></label><input className="form-input" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={set("phone")} /></div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">City / Place <span className="optional-tag">(optional)</span></label><input className="form-input" placeholder="e.g. Chennai, Mumbai" value={form.place} onChange={set("place")} /></div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label className="form-label">Parent's Email <span className="optional-tag">(optional)</span></label>
            <input className="form-input" type="email" placeholder="e.g. parent@example.com" value={form.parentEmail} onChange={set("parentEmail")} />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>If added, your parent gets a weekly email with your score, streak, and weak areas — no login needed on their end.</p>
          </div>
        </div>

        {/* Weak subjects */}
        <div className="mb-5">
          <label className="form-label">Weak Subjects</label>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {SUBJECTS.map(s => (
              <span key={s} onClick={() => toggleSubj("weakSubjects", s)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: form.weakSubjects.includes(s) ? "var(--red-light)" : "var(--gray2)", color: form.weakSubjects.includes(s) ? "var(--red)" : "var(--text2)", border: form.weakSubjects.includes(s) ? "1.5px solid var(--red)" : "1.5px solid transparent" }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Strong subjects */}
        <div className="mb-5">
          <label className="form-label">Strong Subjects</label>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {SUBJECTS.map(s => (
              <span key={s} onClick={() => toggleSubj("strongSubjects", s)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: form.strongSubjects.includes(s) ? "var(--green-light)" : "var(--gray2)", color: form.strongSubjects.includes(s) ? "var(--green)" : "var(--text2)", border: form.strongSubjects.includes(s) ? "1.5px solid var(--green)" : "1.5px solid transparent" }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn btn-blue" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
          {saved && <span className="chip chip-green">✓ Saved!</span>}
          <button className="btn btn-outline" style={{ marginLeft: "auto", color: "var(--red)", borderColor: "var(--red-light)" }} onClick={() => { if (window.confirm("Log out of YNeet?")) logout(); }}>Logout</button>
        </div>
      </div>
    </div>
  );
}
