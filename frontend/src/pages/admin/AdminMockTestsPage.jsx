import { useEffect, useState } from "react";
import api from "../../lib/api";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];

const emptyTest = {
  title: "", type: "full", subject: "Physics", classLevel: "12th",
  totalMarks: 720, totalQs: 200, durationMin: 200,
};

export default function AdminMockTestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | test object being edited
  const [form, setForm] = useState(emptyTest);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/mocktests", { params: { classLevel: classFilter || undefined } })
      .then(r => setTests(r.data.mockTests))
      .finally(() => setLoading(false));
  };

  useEffect(load, [classFilter]);

  const openNew = () => { setForm(emptyTest); setModal("new"); };
  const openEdit = (t) => { setForm(t); setModal(t.id); };
  const close = () => setModal(null);

  const save = async () => {
    setSaving(true);
    try {
      if (modal === "new") await api.post("/admin/mocktests", form);
      else await api.put(`/admin/mocktests/${modal}`, form);
      close();
      load();
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setSaving(false);
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/mocktests/${t.id}`);
      load();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.attemptCount) {
        if (window.confirm(`${data.attemptCount} student(s) have already attempted this test. Delete it AND their attempt records anyway?`)) {
          await api.delete(`/admin/mocktests/${t.id}?force=true`);
          load();
        }
      } else {
        alert(data?.message || "Delete failed");
      }
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Mock Tests ({tests.length})</h1>
        <button className="btn btn-blue" onClick={openNew}>+ New Mock Test</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select className="form-select" style={{ width: 160 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Subject</th><th>Class</th><th>Duration</th><th>Marks</th><th>Qs</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && tests.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No mock tests yet.</td></tr>}
            {tests.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.title}</td>
                <td style={{ textTransform: "capitalize" }}>{t.type}</td>
                <td>{t.type === "subject" ? t.subject : "—"}</td>
                <td>{t.classLevel}</td>
                <td>{t.durationMin}m</td>
                <td>{t.totalMarks}</td>
                <td>{t.totalQs}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(t)}>Edit</button>{" "}
                  <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => remove(t)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 12 }}>
        Creating a test here just makes the empty shell — go to the Questions tab to assign existing questions to it via the "Assign to Mock Test(s)" checklist in each question's editor.
      </p>

      {modal && (
        <div className="admin-modal-backdrop" onClick={close}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{modal === "new" ? "New Mock Test" : "Edit Mock Test"}</h2>

            <label className="form-label">Title</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.title} onChange={set("title")} placeholder="e.g. YNeet Full Mock Test 05" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={set("type")}>
                  <option value="full">Full Length (all 3 subjects)</option>
                  <option value="subject">Subject-wise</option>
                </select>
              </div>
              {form.type === "subject" && (
                <div>
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={form.subject} onChange={set("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
                </div>
              )}
              <div>
                <label className="form-label">Class Level</label>
                <select className="form-select" value={form.classLevel} onChange={set("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <label className="form-label">Duration (minutes)</label>
                <input className="form-input" type="number" min="1" value={form.durationMin} onChange={set("durationMin")} />
              </div>
              <div>
                <label className="form-label">Total Marks</label>
                <input className="form-input" type="number" min="0" value={form.totalMarks} onChange={set("totalMarks")} />
              </div>
              <div>
                <label className="form-label">Total Questions</label>
                <input className="form-input" type="number" min="0" value={form.totalQs} onChange={set("totalQs")} />
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 14 }}>
              Marks/question counts here are just the displayed target — the test's actual content is whatever questions you assign to it from the Questions tab.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={close}>Cancel</button>
              <button className="btn btn-blue" onClick={save} disabled={saving || !form.title}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
