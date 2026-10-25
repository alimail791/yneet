import { useEffect, useState } from "react";
import api from "../../lib/api";
import { CURRICULUM } from "../../utils/curriculum";

const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper", "All"];
const SUBJECTS = ["Physics", "Chemistry", "Biology"];
const LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada", "Bengali", "Marathi"];
const empty = {
  title: "", description: "", subject: "Biology", classLevel: "12th", chapter: "", language: "English",
  videoLink: "", durationMin: "", creatorName: "", isPublished: true, questions: [],
};

// Turns stored { provider, videoRef } back into a link the admin can open/edit.
function videoLinkOf(s) {
  if (s.provider === "youtube") return `https://youtu.be/${s.videoRef}`;
  if (s.provider === "bunny") return `https://iframe.mediadelivery.net/embed/${s.videoRef}`;
  return s.videoRef;
}

function chaptersFor(classLevel, subject) {
  if (classLevel === "All") return [...new Set(Object.values(CURRICULUM).flatMap(c => c[subject] || []))];
  return CURRICULUM[classLevel]?.[subject] || [];
}

export default function AdminShortsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [creators, setCreators] = useState([]);
  const [reportDays, setReportDays] = useState(7);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickNote, setPickNote] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/shorts", { params: { subject: subjectFilter || undefined, creator: creatorFilter || undefined } })
      .then(r => setItems(r.data.shorts)).finally(() => setLoading(false));
  };
  const loadCreators = () => api.get("/admin/shorts/creators", { params: { days: reportDays } }).then(r => setCreators(r.data.creators)).catch(() => {});
  useEffect(load, [subjectFilter, creatorFilter]);
  useEffect(() => { loadCreators(); }, [reportDays]);

  const openNew = () => { setForm({ ...empty, creatorName: form.creatorName || "" }); setPickNote(""); setSearchResults(null); setSearch(""); setModal("new"); };
  const openEdit = (s) => {
    setForm({
      title: s.title, description: s.description || "", subject: s.subject, classLevel: s.classLevel, chapter: s.chapter,
      language: s.language, videoLink: videoLinkOf(s), durationMin: s.durationSec ? String(Math.round(s.durationSec / 6) / 10) : "",
      creatorName: s.creatorName, isPublished: s.isPublished, questions: s.questions,
    });
    setPickNote(""); setSearchResults(null); setSearch(""); setModal(s.id);
  };
  const close = () => setModal(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const autoPick = async () => {
    if (!form.chapter) { setPickNote("Choose a chapter first."); return; }
    setPicking(true); setPickNote("");
    try {
      const need = Math.max(3 - form.questions.length, 1);
      const { data } = await api.get("/admin/shorts/suggest-questions", {
        params: { subject: form.subject, classLevel: form.classLevel, chapter: form.chapter, count: need, exclude: form.questions.map(q => q.id).join(",") },
      });
      if (!data.questions.length) setPickNote(`No questions found for "${form.chapter}" — search below instead.`);
      setForm(f => ({ ...f, questions: [...f.questions, ...data.questions].slice(0, 5) }));
    } catch (err) { setPickNote(err?.response?.data?.message || "Couldn't fetch questions"); }
    setPicking(false);
  };

  const runSearch = async () => {
    if (!search.trim()) return;
    const { data } = await api.get("/admin/questions", { params: { search: search.trim(), subject: form.subject, limit: 10 } });
    setSearchResults(data.questions);
  };
  const addQuestion = (q) => setForm(f => f.questions.some(x => x.id === q.id) || f.questions.length >= 5 ? f : ({ ...f, questions: [...f.questions, q] }));
  const removeQuestion = (id) => setForm(f => ({ ...f, questions: f.questions.filter(q => q.id !== id) }));

  const save = async () => {
    setSaving(true);
    const { durationMin, questions, ...rest } = form;
    const payload = {
      ...rest,
      durationSec: durationMin === "" ? null : Math.round(Number(durationMin) * 60),
      questionIds: questions.map(q => q.id),
    };
    try {
      if (modal === "new") await api.post("/admin/shorts", payload);
      else await api.put(`/admin/shorts/${modal}`, payload);
      close(); load(); loadCreators();
    } catch (err) { alert(err?.response?.data?.message || "Save failed"); }
    setSaving(false);
  };

  const togglePublish = async (s) => {
    await api.put(`/admin/shorts/${s.id}`, { isPublished: !s.isPublished });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this Short? Watch history for it will be removed too.")) return;
    await api.delete(`/admin/shorts/${id}`);
    load(); loadCreators();
  };

  const chapterOptions = chaptersFor(form.classLevel, form.subject);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Shorts ({items.length})</h1>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Upload the video to YouTube (unlisted) or Bunny Stream, then paste its link here.</p>
        </div>
        <button className="btn btn-blue" onClick={openNew}>+ Add Short</button>
      </div>

      {/* Creator report — what each creator published and how it's being watched, for weekly payouts. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800 }}>Creator report</h2>
          <select className="form-select" style={{ width: 150 }} value={reportDays} onChange={e => setReportDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
          </select>
        </div>
        {creators.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text3)" }}>No Shorts yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead><tr><th>Creator</th><th>Shorts added ({reportDays}d)</th><th>New viewers ({reportDays}d)</th><th>Total Shorts</th><th>Total viewers</th></tr></thead>
              <tbody>
                {creators.map(c => (
                  <tr key={c.creatorName} style={{ cursor: "pointer" }} onClick={() => setCreatorFilter(f => f === c.creatorName ? "" : c.creatorName)}>
                    <td style={{ fontWeight: 700 }}>{c.creatorName}{creatorFilter === c.creatorName && " ✓"}</td>
                    <td>{c.shortsInPeriod}</td><td>{c.viewsInPeriod}</td><td>{c.totalShorts}</td><td>{c.totalViews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select className="form-select" style={{ width: 150 }} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="">All Subjects</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        {creatorFilter && <button className="btn btn-outline btn-sm" onClick={() => setCreatorFilter("")}>Creator: {creatorFilter} ✕</button>}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Title</th><th>Subject / Chapter</th><th>Class</th><th>Language</th><th>Creator</th><th>MCQs</th><th>Viewers</th><th>Quiz acc.</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No Shorts yet — add your first one.</td></tr>}
            {items.map(s => (
              <tr key={s.id}>
                <td style={{ maxWidth: 240 }}>
                  <a href={videoLinkOf(s)} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--blue-mid)" }}>{s.title}</a>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.provider}</div>
                </td>
                <td>{s.subject}<div style={{ fontSize: 12, color: "var(--text3)" }}>{s.chapter}</div></td>
                <td>{s.classLevel}</td>
                <td>{s.language}</td>
                <td>{s.creatorName}</td>
                <td>{s.questions.length}</td>
                <td>{s.viewCount}</td>
                <td>{s.quizAccuracy === null ? "—" : `${s.quizAccuracy}%`}</td>
                <td>
                  <span className={`chip ${s.isPublished ? "chip-green" : "chip-amber"}`} style={{ cursor: "pointer" }} onClick={() => togglePublish(s)} title="Click to toggle">
                    {s.isPublished ? "Live" : "Hidden"}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Edit</button>{" "}
                  <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="admin-modal-backdrop" onClick={close}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{modal === "new" ? "Add Short" : "Edit Short"}</h2>

            <label className="form-label">Video link</label>
            <input className="form-input" style={{ marginBottom: 4 }} value={form.videoLink} onChange={set("videoLink")} placeholder="https://youtu.be/… or Bunny embed link or .mp4 URL" />
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 12 }}>YouTube: upload as <strong>Unlisted</strong> so it only plays inside YNeet. Bunny Stream: paste the embed link from the video's page.</p>

            <label className="form-label">Title</label>
            <input className="form-input" style={{ marginBottom: 12 }} value={form.title} onChange={set("title")} placeholder="e.g. Mitosis in 4 minutes" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label className="form-label">Subject</label><select className="form-select" value={form.subject} onChange={set("subject")}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="form-label">Class</label><select className="form-select" value={form.classLevel} onChange={set("classLevel")}>{CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="form-label">Language</label><select className="form-select" value={form.language} onChange={set("language")}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
            </div>

            <label className="form-label">Chapter</label>
            <input className="form-input" style={{ marginBottom: 12 }} list="short-chapters" value={form.chapter} onChange={set("chapter")} placeholder="Pick or type a chapter" />
            <datalist id="short-chapters">{chapterOptions.map(c => <option key={c} value={c} />)}</datalist>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label className="form-label">Creator name</label><input className="form-input" value={form.creatorName} onChange={set("creatorName")} placeholder="e.g. Priya Ma'am" /></div>
              <div><label className="form-label">Length (minutes)<span className="optional-tag">optional</span></label><input className="form-input" type="number" min="0" step="0.5" value={form.durationMin} onChange={set("durationMin")} placeholder="e.g. 4" /></div>
            </div>

            <label className="form-label">Description<span className="optional-tag">optional</span></label>
            <textarea className="form-input" style={{ minHeight: 50, marginBottom: 14 }} value={form.description} onChange={set("description")} placeholder="One line on what students will learn" />

            <div style={{ background: "var(--gray2)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <label className="form-label" style={{ margin: 0 }}>Quick-check MCQs ({form.questions.length}/5)</label>
                <button className="btn btn-purple btn-sm" onClick={autoPick} disabled={picking || form.questions.length >= 5}>{picking ? "Picking..." : "✨ Auto-pick from this chapter"}</button>
              </div>
              {pickNote && <p style={{ fontSize: 12, color: "var(--amber)", marginBottom: 8 }}>{pickNote}</p>}
              {form.questions.length === 0 && <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>2–3 questions work best. They come from your existing question bank.</p>}
              {form.questions.map((q, i) => (
                <div key={q.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fff", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                  <strong>{i + 1}.</strong>
                  <span style={{ flex: 1 }}>{q.questionText.length > 140 ? q.questionText.slice(0, 140) + "…" : q.questionText}</span>
                  <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)", padding: "2px 8px" }} onClick={() => removeQuestion(q.id)}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input className="form-input" style={{ padding: "7px 10px", fontSize: 13 }} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} placeholder="Or search question text…" />
                <button className="btn btn-outline btn-sm" onClick={runSearch}>Search</button>
              </div>
              {searchResults && (
                <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                  {searchResults.length === 0 && <p style={{ fontSize: 12, color: "var(--text3)" }}>No matches.</p>}
                  {searchResults.map(q => (
                    <div key={q.id} onClick={() => addQuestion(q)} style={{ fontSize: 12.5, padding: "6px 8px", borderBottom: "1px solid var(--gray3)", cursor: "pointer", opacity: form.questions.some(x => x.id === q.id) ? 0.4 : 1 }}>
                      + {q.questionText.length > 120 ? q.questionText.slice(0, 120) + "…" : q.questionText} <span style={{ color: "var(--text3)" }}>({q.chapter})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={form.isPublished} onChange={set("isPublished")} /> Live — visible to students
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-outline" onClick={close}>Cancel</button>
              <button className="btn btn-blue" onClick={save} disabled={saving || !form.title || !form.videoLink || !form.chapter}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
