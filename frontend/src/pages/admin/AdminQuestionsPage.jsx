import { useEffect, useState } from "react";
import Papa from "papaparse";
import api from "../../lib/api";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const DIFFICULTIES = ["easy", "medium", "hard"];

const emptyQ = {
  subject: "Biology", classLevel: "12th", chapter: "", topic: "", difficulty: "medium",
  questionText: "", optionA: "", optionB: "", optionC: "", optionD: "",
  correctOpt: 0, explanation: "", isPYQ: false, isRepeated: false, pyqYear: "",
  mockTestIds: [],
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
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [aiForm, setAiForm] = useState({ subject: "Biology", classLevel: "12th", chapter: "", count: 5 });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiItems, setAiItems] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [scanModal, setScanModal] = useState(false);
  const [scanForm, setScanForm] = useState({ subject: "Biology", classLevel: "12th" });
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanItems, setScanItems] = useState(null);
  const [scanError, setScanError] = useState(null);

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
  const openEdit = (q) => { setForm({ ...q, pyqYear: q.pyqYear || "", mockTestIds: (q.mockTests || []).map(mt => mt.id) }); setModal(q.id); };
  const close = () => setModal(null);

  const save = async () => {
    setSaving(true);
    const { mockTests, ...rest } = form; // drop the joined display-only array before sending
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

  const openBulk = () => { setBulkRows([]); setBulkFileName(""); setBulkResult(null); setBulkModal(true); };
  const closeBulk = () => setBulkModal(false);

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setBulkRows(results.data),
      error: (err) => alert("Could not read that CSV: " + err.message),
    });
  };

  const submitBulk = async () => {
    if (bulkRows.length === 0) return;
    setBulkUploading(true);
    try {
      const { data } = await api.post("/admin/questions/bulk", { questions: bulkRows });
      setBulkResult(data);
      if (data.created > 0) load();
    } catch (err) {
      alert(err?.response?.data?.message || "Bulk upload failed");
    }
    setBulkUploading(false);
  };

  const openAi = () => { setAiForm(f => ({ ...f, chapter: "" })); setAiItems(null); setAiError(null); setAiModal(true); };
  const closeAi = () => setAiModal(false);

  const generateWithAi = async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const { data } = await api.post("/admin/ai/generate", { type: "question", ...aiForm });
      setAiItems(data.items.map(item => ({ ...item, _keep: true })));
    } catch (err) {
      setAiError(err?.response?.data?.message || "Generation failed");
    }
    setAiGenerating(false);
  };

  const saveAiItems = async () => {
    const toSave = aiItems.filter(i => i._keep).map(({ _keep, ...rest }) => rest);
    if (toSave.length === 0) return;
    setAiGenerating(true);
    try {
      const { data } = await api.post("/admin/questions/bulk", { questions: toSave });
      closeAi();
      load();
      alert(`${data.created} question(s) added.${data.failed ? ` ${data.failed} failed.` : ""}`);
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setAiGenerating(false);
  };

  const openScan = () => { setScanFile(null); setScanPreview(null); setScanItems(null); setScanError(null); setScanModal(true); };
  const closeScan = () => setScanModal(false);

  const handleScanFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Please choose a JPEG, PNG, or WebP image (a clear photo or scan of the paper page).");
      return;
    }
    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
    setScanItems(null);
    setScanError(null);
  };

  const runScan = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(scanFile);
      });
      const { data } = await api.post("/admin/ai/extract-questions", {
        imageBase64: base64, mediaType: scanFile.type, ...scanForm,
      });
      setScanItems(data.items.map(item => ({ ...item, _keep: true })));
    } catch (err) {
      setScanError(err?.response?.data?.message || "Scan failed");
    }
    setScanning(false);
  };

  const saveScanItems = async () => {
    const toSave = scanItems.filter(i => i._keep).map(({ _keep, ...rest }) => rest);
    if (toSave.length === 0) return;
    setScanning(true);
    try {
      const { data } = await api.post("/admin/questions/bulk", { questions: toSave });
      closeScan();
      load();
      alert(`${data.created} question(s) added.${data.failed ? ` ${data.failed} failed.` : ""}`);
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setScanning(false);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Questions ({total})</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-purple" onClick={openAi}>✨ Generate with AI</button>
          <button className="btn btn-purple" onClick={openScan}>📄 Scan Question Paper</button>
          <button className="btn btn-outline" onClick={openBulk}>⬆ Bulk Upload CSV</button>
          <button className="btn btn-blue" onClick={openNew}>+ Add Question</button>
        </div>
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
                <td>{q.mockTests?.length ? q.mockTests.map(mt => <span key={mt.id} className="chip chip-blue" style={{ marginRight: 4, marginBottom: 4, display: "inline-block" }}>{mt.title}</span>) : <span style={{ color: "var(--text3)" }}>— Practice/Quiz only</span>}</td>
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

            <label className="form-label">Assign to Mock Test(s)</label>
            <div style={{ border: "1.5px solid var(--gray3)", borderRadius: 8, padding: "8px 12px", maxHeight: 130, overflowY: "auto", marginBottom: 4 }}>
              {mockTests.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text3)", padding: "6px 0" }}>No matching mock tests for this class/subject yet.</p>}
              {mockTests.map(mt => (
                <label key={mt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13.5, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.mockTestIds.includes(mt.id)}
                    onChange={(e) => setForm(f => ({
                      ...f,
                      mockTestIds: e.target.checked ? [...f.mockTestIds, mt.id] : f.mockTestIds.filter(id => id !== mt.id),
                    }))}
                  />
                  {mt.title} ({mt.type === "full" ? "Full" : mt.subject})
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14 }}>
              A question can belong to multiple tests. Only tests matching this question's class {form.subject && "and subject"} are shown. Leave everything unchecked if it should only appear in Practice and Daily Quiz.
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

      {bulkModal && (
        <div className="admin-modal-backdrop" onClick={closeBulk}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Bulk Upload Questions (CSV)</h2>

            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 14 }}>
              Your CSV needs a header row with these column names (case-sensitive):<br />
              <code style={{ fontSize: 11.5 }}>
                subject, classLevel, chapter, topic, difficulty, questionText, optionA, optionB, optionC, optionD, correctOpt, explanation, isPYQ, pyqYear, isRepeated
              </code>
              <br /><br />
              <strong>correctOpt</strong> is 0, 1, 2, or 3 (A/B/C/D). <strong>difficulty</strong> defaults to "medium" if left blank.
              <strong> isPYQ</strong>/<strong>isRepeated</strong> should be TRUE or FALSE. Uploaded questions land unassigned —
              open each one afterwards to assign it to a mock test, or leave it for Practice/Daily Quiz only.
            </p>

            <input type="file" accept=".csv" onChange={handleCsvFile} style={{ marginBottom: 14 }} />

            {bulkFileName && !bulkResult && (
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
                <strong>{bulkFileName}</strong> — {bulkRows.length} row{bulkRows.length === 1 ? "" : "s"} ready to upload.
              </p>
            )}

            {bulkResult && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, marginBottom: 8 }}>
                  <span className="chip chip-green">{bulkResult.created} created</span>{" "}
                  {bulkResult.failed > 0 && <span className="chip chip-red">{bulkResult.failed} failed</span>}
                </p>
                {bulkResult.errors.length > 0 && (
                  <div style={{ maxHeight: 160, overflowY: "auto", border: "1.5px solid var(--gray3)", borderRadius: 8, padding: "8px 12px" }}>
                    {bulkResult.errors.map((e, i) => (
                      <p key={i} style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 4 }}>Row {e.row}: {e.message}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={closeBulk}>{bulkResult ? "Close" : "Cancel"}</button>
              {!bulkResult && (
                <button className="btn btn-blue" onClick={submitBulk} disabled={bulkUploading || bulkRows.length === 0}>
                  {bulkUploading ? "Uploading..." : `Upload ${bulkRows.length} Question${bulkRows.length === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {aiModal && (
        <div className="admin-modal-backdrop" onClick={closeAi}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>✨ Generate Questions with AI</h2>

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
                    <input className="form-input" value={aiForm.chapter} onChange={e => setAiForm(f => ({ ...f, chapter: e.target.value }))} placeholder="e.g. Genetics" />
                  </div>
                  <div>
                    <label className="form-label">How many? (max 10)</label>
                    <input className="form-input" type="number" min="1" max="10" value={aiForm.count} onChange={e => setAiForm(f => ({ ...f, count: e.target.value }))} />
                  </div>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 16 }}>
                  AI-generated questions are drafts — review each one below before adding, since an LLM can occasionally get a fact or syllabus detail wrong.
                </p>
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
                  {aiItems.length} question{aiItems.length === 1 ? "" : "s"} generated — uncheck any you don't want to keep.
                </p>
                <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 16 }}>
                  {aiItems.map((item, i) => (
                    <label key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--gray3)", cursor: "pointer", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={item._keep} style={{ marginTop: 4 }}
                        onChange={(e) => setAiItems(items => items.map((it, idx) => idx === i ? { ...it, _keep: e.target.checked } : it))} />
                      <div>
                        <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{item.questionText}</p>
                        <p style={{ fontSize: 12, color: "var(--text3)" }}>
                          {item.chapter} · {item.topic} · Correct: {["A", "B", "C", "D"][item.correctOpt]}) {[item.optionA, item.optionB, item.optionC, item.optionD][item.correctOpt]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setAiItems(null)}>← Back</button>
                  <button className="btn btn-blue" onClick={saveAiItems} disabled={aiGenerating || aiItems.every(i => !i._keep)}>
                    {aiGenerating ? "Saving..." : `Add ${aiItems.filter(i => i._keep).length} Question${aiItems.filter(i => i._keep).length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {scanModal && (
        <div className="admin-modal-backdrop" onClick={closeScan}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>📄 Scan Question Paper</h2>

            {!scanItems && (
              <>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
                  Upload a clear photo or scan of one question paper page. The AI reads it and transcribes every question it can — review each one before saving, since handwriting or a blurry photo can trip it up.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label">Subject (helps it read correctly)</label>
                    <select className="form-select" value={scanForm.subject} onChange={e => setScanForm(f => ({ ...f, subject: e.target.value }))}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
                  </div>
                  <div>
                    <label className="form-label">Class Level</label>
                    <select className="form-select" value={scanForm.classLevel} onChange={e => setScanForm(f => ({ ...f, classLevel: e.target.value }))}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleScanFile} style={{ marginBottom: 14 }} />
                {scanPreview && (
                  <img src={scanPreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, border: "1px solid var(--gray3)", marginBottom: 14, display: "block" }} />
                )}
                {scanError && <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{scanError}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-outline" onClick={closeScan}>Cancel</button>
                  <button className="btn btn-purple" onClick={runScan} disabled={scanning || !scanFile}>
                    {scanning ? "Reading paper..." : "Scan & Extract"}
                  </button>
                </div>
              </>
            )}

            {scanItems && (
              <>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
                  {scanItems.length} question{scanItems.length === 1 ? "" : "s"} read from the image — uncheck any that look wrong, and fix answers/text elsewhere afterward if needed.
                </p>
                <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 16 }}>
                  {scanItems.map((item, i) => (
                    <label key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--gray3)", cursor: "pointer", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={item._keep} style={{ marginTop: 4 }}
                        onChange={(e) => setScanItems(items => items.map((it, idx) => idx === i ? { ...it, _keep: e.target.checked } : it))} />
                      <div>
                        <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{item.questionText}</p>
                        <p style={{ fontSize: 12, color: "var(--text3)" }}>
                          {item.chapter} · Correct: {["A", "B", "C", "D"][item.correctOpt]}) {[item.optionA, item.optionB, item.optionC, item.optionD][item.correctOpt]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-outline" onClick={() => setScanItems(null)}>← Back</button>
                  <button className="btn btn-blue" onClick={saveScanItems} disabled={scanning || scanItems.every(i => !i._keep)}>
                    {scanning ? "Saving..." : `Add ${scanItems.filter(i => i._keep).length} Question${scanItems.filter(i => i._keep).length === 1 ? "" : "s"}`}
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
