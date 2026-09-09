import { useEffect, useState } from "react";
import api from "../../lib/api";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const empty = { subject: "Biology", classLevel: "12th", chapter: "", front: "", back: "" };

export default function AdminFlashcardsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/flashcards", { params: { classLevel: classFilter || undefined, subject: subjectFilter || undefined } })
      .then(r => setItems(r.data.flashcards)).finally(() => setLoading(false));
  };
  useEffect(load, [classFilter, subjectFilter]);

  const openNew = () => { setForm(empty); setModal("new"); };
  const openEdit = (f) => { setForm(f); setModal(f.id); };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      if (modal === "new") await api.post("/admin/flashcards", form);
      else await api.put(`/admin/flashcards/${modal}`, form);
      close(); load();
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this flashcard?")) return;
    await api.delete(`/admin/flashcards/${id}`);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flashcards ({items.length})</h1>
        <button className="btn btn-blue" onClick={openNew}>+ Add Flashcard</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: 140 }} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="">All Subjects</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width: 140 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Front</th><th>Back</th><th>Subject</th><th>Chapter</th><th>Class</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No flashcards found.</td></tr>}
            {items.map(f => (
              <tr key={f.id}>
                <td style={{ maxWidth: 220 }}>{f.front}</td>
                <td style={{ maxWidth: 260 }}>{f.back}</td>
                <td>{f.subject}</td>
                <td>{f.chapter}</td>
                <td>{f.classLevel}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(f)}>Edit</button>{" "}
                  <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => remove(f.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="admin-modal-backdrop" onClick={close}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{modal === "new" ? "Add Flashcard" : "Edit Flashcard"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label className="form-label">Subject</label><select className="form-select" value={form.subject} onChange={set("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="form-label">Class Level</label><select className="form-select" value={form.classLevel} onChange={set("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <label className="form-label">Chapter</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.chapter} onChange={set("chapter")} />
            <label className="form-label">Front (question)</label>
            <textarea className="form-input" style={{ minHeight: 50, marginBottom: 12 }} value={form.front} onChange={set("front")} />
            <label className="form-label">Back (answer)</label>
            <textarea className="form-input" style={{ minHeight: 70, marginBottom: 18 }} value={form.back} onChange={set("back")} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={close}>Cancel</button>
              <button className="btn btn-blue" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
