import { useState, useRef, useEffect } from "react";
import api from "../../lib/api";

const BASE = "/admin/mock-builder/chapter-tests";

// Admin tool: 2 tests x 20 questions for every chapter of Physics, Chemistry,
// Botany and Zoology, for 11th / 12th / Dropper. Preview first, then build.
export default function ChapterTestsPanel() {
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const poll = async () => {
    try {
      const { data } = await api.get(`${BASE}/status`);
      setJob(data.job);
      if (!data.job?.running) { clearInterval(timer.current); timer.current = null; }
    } catch { /* keep polling */ }
  };
  useEffect(() => {
    poll();
    return () => clearInterval(timer.current);
  }, []);

  const loadPreview = async () => {
    setBusy(true);
    try { setPreview((await api.get(`${BASE}/preview`)).data); }
    catch (e) { alert(e?.response?.data?.message || "Preview failed"); }
    setBusy(false);
  };

  const build = async () => {
    if (!preview) return alert("Run the preview first.");
    if (!window.confirm(`Create up to ${preview.plannedTests} chapter tests (2 per chapter, 20 questions each)? Tests that already exist are skipped.`)) return;
    try {
      await api.post(`${BASE}/build`);
      if (!timer.current) timer.current = setInterval(poll, 2000);
      poll();
    } catch (e) { alert(e?.response?.data?.message || "Could not start"); }
  };

  const remove = async () => {
    if (!window.confirm("Delete ALL chapter tests (and any student attempts on them)? Questions are not deleted.")) return;
    try {
      const { data } = await api.post(`${BASE}/delete`);
      alert(`Deleted ${data.deletedTests} chapter tests${data.deletedAttempts ? ` and ${data.deletedAttempts} attempts` : ""}.`);
      setPreview(null);
    } catch (e) { alert(e?.response?.data?.message || "Delete failed"); }
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-title">📚 Chapter-wise tests</div>
      <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "4px 0 12px" }}>
        11th, 12th &amp; Dropper · Physics, Chemistry, Botany, Zoology · 2 tests × 20 questions for every chapter.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="btn btn-outline" onClick={loadPreview} disabled={busy || job?.running}>🔍 Preview</button>
        <button className="btn btn-purple" onClick={build} disabled={!preview || job?.running}>
          {job?.running ? `Building… (${job.done}/${job.total})` : "📦 Create chapter tests"}
        </button>
        <button className="btn btn-outline" onClick={remove} disabled={job?.running}>🗑 Delete all chapter tests</button>
      </div>

      {preview && (
        <div style={{ fontSize: 12.5 }}>
          <div style={{ marginBottom: 6 }}>
            <b>{preview.plannedTests}</b> tests planned · {preview.existingChapterTests} already exist · {preview.unmappedQuestions} of {preview.totalQuestions} questions have no matching chapter (ignored)
          </div>
          {Object.entries(preview.summary).map(([k, s]) => (
            <div key={k}>{k}: {s.chapters} chapters → {s.tests} tests{s.reuse ? ` (${s.reuse} chapters will reuse questions between the 2 tests)` : ""}{s.skipped ? ` · ${s.skipped} skipped (too few questions)` : ""}</div>
          ))}
          {preview.thin.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", color: "var(--amber)", fontWeight: 700 }}>{preview.thin.length} chapters have fewer than 40 questions</summary>
              {preview.thin.map((t, i) => (
                <div key={i}>{t.status === "skip" ? "⛔" : "⚠️"} {t.classLevel} {t.subject} · {t.chapter}: {t.questions} Qs</div>
              ))}
            </details>
          )}
        </div>
      )}

      {job && (
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          {job.running ? "⏳ Running…" : "✅ Finished"} — created {job.done}/{job.total}
          {job.existing ? ` · ${job.existing} already existed` : ""}{job.failed ? ` · ${job.failed} failed` : ""}
          {job.skipped?.length > 0 && !job.running && (
            <details><summary style={{ cursor: "pointer" }}>{job.skipped.length} skipped</summary>{job.skipped.map((s, i) => <div key={i}>{s}</div>)}</details>
          )}
          {job.log?.map((l, i) => <div key={i} style={{ color: "var(--red, #c00)" }}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
