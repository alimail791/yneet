import { useEffect, useState } from "react";
import api from "../../lib/api";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const DIFFICULTIES = ["easy", "medium", "hard"];

const emptyQ = {
  subject: "Biology", classLevel: "12th", chapter: "", topic: "", difficulty: "medium",
  questionText: "", optionA: "", optionB: "", optionC: "", optionD: "",
  correctOpt: 0, explanation: "", isPYQ: false, isRepeated: false, pyqYear: "",
  mockTestId: "",
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | question object being edited
  const [form, setForm] = useState(emptyQ);
  const [saving, setSaving] = useState(false);
  const [mockTests, setMockTests] = useState([]);

  const load = () => {
    setLoading(true);
    api.get("/admin/questions", { params: { classLevel: classFilter || undefined, subject: subjectFilter || undefined, search: search || undefined, limit: 100 } })
      .then(r => { setQuestions(r.data.questions); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [classFilter, subjectFilter]);

  // Mock test dropdown options depend on the form's own class/subject — e.g. a
  // Physics question can go into a "full" test or a Physics-specific one, but
  // not a Chemistry-specific one. Refetches whenever those two fields change.
  useEffect(() => {
    if (!modal) return;
    api.get("/admin/mocktests", { params: { classLevel: form.classLevel, subject: form.subject } })
      .then(r => setMockTests(r.data.mockTests))
      .catch(() => setMockTests([]));
  }, [modal, form.classLevel, form.subject]);

  const openNew = () => { setForm(emptyQ); setModal("new"); };
  const openEdit = (q) => { setForm({ ...q, pyqYear: q.pyqYear || "", mockTestId: q.mockTestId || "" }); setModal(q.id); };
  const close = () => setModal(null);

  const save = async () => {
    setSaving(true);
    const { mockTest, ...rest } = form; // drop the joined display-only object before sending
    const payload = { ...rest, correctOpt: Number(form.correctOpt), pyqYear: form.pyqYear ? Number(form.pyqYear) : null };
    try {
      if (modal === "new") await api.post("/admin/questions", payload);
      else await api.put(`/admin/questions/${modal}`, payload);
      close();
      load();
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this question permanently?")) return;
    await api.delete(`/admin/questions/${id}`);
    load();
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Questions ({total})</h1>
        <button className="btn btn-blue" onClick={openNew}>+ Add Question</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" style={{ width: 220 }} placeholder="Search question text..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        <select className="form-select" style={{ width: 140 }} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="">All Subjects</option>
          {SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width: 140 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-outline" onClick={load}>Search</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>Question</th><th>Subject</th><th>Class</th><th>Chapter</th><th>Difficulty</th><th>Mock Test</th><th>PYQ</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && questions.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No questions found.</td></tr>}
            {questions.map(q => (
              <tr key={q.id}>
                <td style={{ maxWidth: 320 }}>{q.questionText}</td>
                <td>{q.subject}</td>
                <td>{q.classLevel}</td>
                <td>{q.chapter}</td>
                <td style={{ textTransform: "capitalize" }}>{q.difficulty}</td>
                <td>{q.mockTest?.title ? <span className="chip chip-blue">{q.mockTest.title}</span> : <span style={{ color: "var(--text3)" }}>— Practice/Quiz only</span>}</td>
                <td>{q.isPYQ ? q.pyqYear || "Yes" : "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(q)}>Edit</button>{" "}
                  <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => remove(q.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="admin-modal-backdrop" onClick={close}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{modal === "new" ? "Add Question" : "Edit Question"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="form-label">Subject</label>
                <select className="form-select" value={form.subject} onChange={set("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <div>
                <label className="form-label">Class Level</label>
                <select className="form-select" value={form.classLevel} onChange={set("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <label className="form-label">Chapter</label>
                <input className="form-input" value={form.chapter} onChange={set("chapter")} placeholder="e.g. Thermodynamics" />
              </div>
              <div>
                <label className="form-label">Topic</label>
                <input className="form-input" value={form.topic} onChange={set("topic")} placeholder="e.g. First Law" />
              </div>
            </div>

            <label className="form-label">Question Text</label>
            <textarea className="form-input" style={{ minHeight: 60, marginBottom: 12 }} value={form.questionText} onChange={set("questionText")} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label className="form-label">Option A</label><input className="form-input" value={form.optionA} onChange={set("optionA")} /></div>
              <div><label className="form-label">Option B</label><input className="form-input" value={form.optionB} onChange={set("optionB")} /></div>
              <div><label className="form-label">Option C</label><input className="form-input" value={form.optionC} onChange={set("optionC")} /></div>
              <div><label className="form-label">Option D</label><input className="form-input" value={form.optionD} onChange={set("optionD")} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="form-label">Correct Option</label>
                <select className="form-select" value={form.correctOpt} onChange={set("correctOpt")}>
                  <option value={0}>A</option><option value={1}>B</option><option value={2}>C</option><option value={3}>D</option>
                </select>
              </div>
              <div>
                <label className="form-label">Difficulty</label>
                <select className="form-select" value={form.difficulty} onChange={set("difficulty")}>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}</select>
              </div>
            </div>

            <label className="form-label">Explanation</label>
            <textarea className="form-input" style={{ minHeight: 50, marginBottom: 12 }} value={form.explanation} onChange={set("explanation")} />

            <label className="form-label">Assign to Mock Test</label>
            <select className="form-select" style={{ marginBottom: 4 }} value={form.mockTestId} onChange={set("mockTestId")}>
              <option value="">— None (Practice / Daily Quiz only) —</option>
              {mockTests.map(mt => <option key={mt.id} value={mt.id}>{mt.title} ({mt.type === "full" ? "Full" : mt.subject})</option>)}
            </select>
            <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>
              Only tests matching this question's class {form.subject && "and subject"} are shown. Leave as "None" if this question should only appear in Practice and Daily Quiz.
            </p>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                <input type="checkbox" checked={form.isPYQ} onChange={set("isPYQ")} /> Is PYQ
              </label>
              {form.isPYQ && <input className="form-input" style={{ width: 110 }} placeholder="Year" value={form.pyqYear} onChange={set("pyqYear")} />}
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                <input type="checkbox" checked={form.isRepeated} onChange={set("isRepeated")} /> Repeated question
              </label>
            </div>

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
