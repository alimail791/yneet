import { useEffect, useState } from "react";
import api from "../../lib/api";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry"];
const empty = { subject: "Physics", classLevel: "12th", chapter: "", title: "", expression: "", notes: "" };

export default function AdminFormulasPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const [aiModal, setAiModal] = useState(false);
  const [aiForm, setAiForm] = useState({ subject: "Physics", classLevel: "12th", chapter: "", count: 5 });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiItems, setAiItems] = useState(null);
  const [aiError, setAiError] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/formulas", { params: { classLevel: classFilter || undefined, subject: subjectFilter || undefined } })
      .then(r => setItems(r.data.formulas)).finally(() => setLoading(false));
  };
  useEffect(load, [classFilter, subjectFilter]);

  const openNew = () => { setForm(empty); setModal("new"); };
  const openEdit = (f) => { setForm(f); setModal(f.id); };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      if (modal === "new") await api.post("/admin/formulas", form);
      else await api.put(`/admin/formulas/${modal}`, form);
      close(); load();
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this formula?")) return;
    await api.delete(`/admin/formulas/${id}`);
    load();
  };

  const openAi = () => { setAiForm(f => ({ ...f, chapter: "" })); setAiItems(null); setAiError(null); setAiModal(true); };
  const closeAi = () => setAiModal(false);

  const generateWithAi = async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const { data } = await api.post("/admin/ai/generate", { type: "formula", ...aiForm });
      setAiItems(data.items.map(item => ({ ...item, _keep: true })));
    } catch (err) {
      setAiError(err?.response?.data?.message || "Generation failed");
    }
    setAiGenerating(false);
  };

  const saveAiItems = async () => {
    const toSave = aiItems.filter(i => i._keep);
    if (toSave.length === 0) return;
    setAiGenerating(true);
    let created = 0;
    for (const { _keep, ...item } of toSave) {
      try { await api.post("/admin/formulas", item); created++; } catch { /* skip failed row */ }
    }
    setAiGenerating(false);
    closeAi();
    load();
    alert(`${created} of ${toSave.length} formula(s) added.`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Formulas ({items.length})</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-purple" onClick={openAi}>✨ Generate with AI</button>
          <button className="btn btn-blue" onClick={openNew}>+ Add Formula</button>
        </div>
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
          <thead><tr><th>Title</th><th>Expression</th><th>Subject</th><th>Chapter</th><th>Class</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No formulas found.</td></tr>}
            {items.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.title}</td>
                <td style={{ fontFamily: "monospace" }}>{f.expression}</td>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{modal === "new" ? "Add Formula" : "Edit Formula"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label className="form-label">Subject</label><select className="form-select" value={form.subject} onChange={set("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="form-label">Class Level</label><select className="form-select" value={form.classLevel} onChange={set("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <label className="form-label">Chapter</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.chapter} onChange={set("chapter")} />
            <label className="form-label">Title</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.title} onChange={set("title")} placeholder="e.g. Newton's Second Law" />
            <label className="form-label">Expression</label>
            <input className="form-input" style={{ marginBottom: 12, fontFamily: "monospace" }} value={form.expression} onChange={set("expression")} placeholder="e.g. F = ma" />
            <label className="form-label">Notes</label>
            <textarea className="form-input" style={{ minHeight: 60, marginBottom: 18 }} value={form.notes} onChange={set("notes")} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={close}>Cancel</button>
              <button className="btn btn-blue" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {aiModal && (
        <div className="admin-modal-backdrop" onClick={closeAi}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>✨ Generate Formulas with AI</h2>

            {!aiItems && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label className="form-label">Subject</label>
                    <select className="form-select" value={aiForm.subject} onChange={e => setAiForm(f => ({ ...f, subject: e.target.value }))}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
                  </div>
                  <div>
                    <label className="form-label">Class Level</label>
                    <select className="form-select" value={aiForm.classLevel} onChange={e => setAiForm(f => ({ ...f, classLevel: e.target.value }))}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div>
                    <label className="form-label">Chapter</label>
                    <input className="form-input" value={aiForm.chapter} onChange={e => setAiForm(f => ({ ...f, chapter: e.target.value }))} placeholder="e.g. Electrostatics" />
                  </div>
                  <div>
                    <label className="form-label">How many? (max 10)</label>
                    <input className="form-input" type="number" min="1" max="10" value={aiForm.count} onChange={e => setAiForm(f => ({ ...f, count: e.target.value }))} />
                  </div>
                </div>
                {aiError && <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{aiError}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-outline" onClick={closeAi}>Cancel</button>
                  <button className="btn btn-purple" onClick={generateWithAi} disabled={aiGenerating || !aiForm.chapter}>
                    {aiGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </>
            )}

            {aiItems && (
              <>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
                  {aiItems.length} formula{aiItems.length === 1 ? "" : "s"} generated — uncheck any you don't want to keep.
                </p>
                <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 16 }}>
                  {aiItems.map((item, i) => (
                    <label key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--gray3)", cursor: "pointer", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={item._keep} style={{ marginTop: 4 }}
                        onChange={(e) => setAiItems(items => items.map((it, idx) => idx === i ? { ...it, _keep: e.target.checked } : it))} />
                      <div>
                        <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{item.title}</p>
                        <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text3)" }}>{item.expression}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setAiItems(null)}>← Back</button>
                  <button className="btn btn-blue" onClick={saveAiItems} disabled={aiGenerating || aiItems.every(i => !i._keep)}>
                    {aiGenerating ? "Saving..." : `Add ${aiItems.filter(i => i._keep).length} Formula${aiItems.filter(i => i._keep).length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
