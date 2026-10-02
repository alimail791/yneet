import { useState, useEffect, useMemo } from "react";
import api from "../../lib/api";
import { CLASS_LEVELS, SUBJECTS, CURRICULUM, TARGETS_PER_CHAPTER } from "../../utils/curriculum";

const GENERATE_URL = "/admin/ai/generate";
const SAVE_URL = {
  question: "/admin/questions",
  flashcard: "/admin/flashcards",
  formula: "/admin/formulas",
};

const TYPE_LABEL = { question: "Questions", flashcard: "Flashcards", formula: "Formulas" };
const TYPE_ICON = { question: "📝", flashcard: "🗂️", formula: "∑" };

function statusColor(count, target) {
  if (count === 0) return "red";
  if (count < target) return "amber";
  return "green";
}

export default function BulkGeneratorPage() {
  const [classLevel, setClassLevel] = useState("11th");
  const [subject, setSubject] = useState("Physics");
  const [coverage, setCoverage] = useState({}); // key -> {question, flashcard, formula}
  const [coverageLoaded, setCoverageLoaded] = useState(false);
  const [coverageError, setCoverageError] = useState(false);

  const [modal, setModal] = useState(null); // { chapter, type, items, loading, saving, error, checked }
  const [autoFill, setAutoFill] = useState(null); // { running, done, total, log: [] }

  const loadCoverage = () => {
    setCoverageLoaded(false);
    setCoverageError(false);
    api
      .get("/admin/content-coverage")
      .then((r) => {
        const map = {};
        for (const row of r.data.coverage || []) {
          map[`${row.classLevel}||${row.subject}||${row.chapter}`] = row;
        }
        setCoverage(map);
      })
      .catch(() => setCoverageError(true))
      .finally(() => setCoverageLoaded(true));
  };

  useEffect(() => {
    loadCoverage();
  }, []);

  const chapters = useMemo(() => CURRICULUM[classLevel]?.[subject] || [], [classLevel, subject]);

  const getCount = (chapter, type) => {
    const row = coverage[`${classLevel}||${subject}||${chapter}`];
    return row ? row[type] || 0 : 0;
  };

  const totals = useMemo(() => {
    let chaptersTotal = 0, chaptersDone = 0;
    let q = 0, fc = 0, f = 0;
    for (const cl of CLASS_LEVELS) {
      for (const sub of SUBJECTS) {
        for (const ch of CURRICULUM[cl]?.[sub] || []) {
          chaptersTotal++;
          const row = coverage[`${cl}||${sub}||${ch}`];
          const qc = row?.question || 0;
          const fcc = row?.flashcard || 0;
          const fcnt = row?.formula || 0;
          q += qc;
          fc += fcc;
          f += fcnt;
          if (qc >= TARGETS_PER_CHAPTER.question && fcc >= TARGETS_PER_CHAPTER.flashcard) chaptersDone++;
        }
      }
    }
    return { chaptersTotal, chaptersDone, q, fc, f };
  }, [coverage]);

  const openGenerate = async (chapter, type) => {
    setModal({ chapter, type, items: [], loading: true, saving: false, error: null, checked: {} });
    try {
      const count = type === "question" ? 10 : type === "flashcard" ? 8 : 6;
      const { data } = await api.post(GENERATE_URL, { type, subject, classLevel, chapter, count });
      const items = data.items || [];
      const checked = {};
      items.forEach((_, i) => (checked[i] = true));
      setModal((m) => ({ ...m, items, loading: false, checked }));
    } catch (err) {
      setModal((m) => ({
        ...m,
        loading: false,
        error: err?.response?.data?.message || "Generation failed — try again.",
      }));
    }
  };

  const toggleItem = (i) => {
    setModal((m) => ({ ...m, checked: { ...m.checked, [i]: !m.checked[i] } }));
  };

  const saveModalItems = async () => {
    if (!modal) return;
    setModal((m) => ({ ...m, saving: true, error: null }));
    const toSave = modal.items.filter((_, i) => modal.checked[i]);
    try {
      for (const item of toSave) {
        await api.post(SAVE_URL[modal.type], { ...item, subject, classLevel, chapter: modal.chapter });
      }
      setModal(null);
      loadCoverage();
    } catch (err) {
      setModal((m) => ({
        ...m,
        saving: false,
        error: err?.response?.data?.message || "Some items failed to save — try again.",
      }));
    }
  };

  const runAutoFill = async () => {
    const jobs = [];
    for (const sub of SUBJECTS) {
      for (const ch of CURRICULUM[classLevel]?.[sub] || []) {
        for (const type of ["question", "flashcard", "formula"]) {
          if (type === "formula" && sub === "Biology") continue;
          const row = coverage[`${classLevel}||${sub}||${ch}`];
          const have = row ? row[type] || 0 : 0;
          const target = TARGETS_PER_CHAPTER[type];
          if (have < target) jobs.push({ sub, ch, type, need: target - have });
        }
      }
    }
    if (jobs.length === 0) {
      setAutoFill({ running: false, done: 0, total: 0, log: ["Everything in this class already meets target — nothing to generate."] });
      return;
    }
    setAutoFill({ running: true, done: 0, total: jobs.length, log: [] });
    for (let i = 0; i < jobs.length; i++) {
      const { sub, ch, type, need } = jobs[i];
      const count = Math.min(need, type === "question" ? 15 : 10);
      try {
        const { data } = await api.post(GENERATE_URL, { type, subject: sub, classLevel, chapter: ch, count });
        const items = data.items || [];
        for (const item of items) {
          await api.post(SAVE_URL[type], { ...item, subject: sub, classLevel, chapter: ch });
        }
        setAutoFill((a) => ({
          ...a,
          done: i + 1,
          log: [...a.log, `✅ ${sub} — ${ch} — ${TYPE_LABEL[type]} (+${items.length})`],
        }));
      } catch (err) {
        setAutoFill((a) => ({
          ...a,
          done: i + 1,
          log: [...a.log, `⚠️ ${sub} — ${ch} — ${TYPE_LABEL[type]} failed: ${err?.response?.data?.message || "error"}`],
        }));
      }
    }
    setAutoFill((a) => ({ ...a, running: false }));
    loadCoverage();
  };

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🏗️ Bulk Chapter Generator</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            Every NCERT chapter, 6th through Dropper — fill the gaps systematically instead of chapter-by-chapter guesswork.
          </p>
        </div>
      </div>

      <div className="card mb-5" style={{ padding: 16 }}>
        {!coverageLoaded ? (
          <div style={{ fontSize: 13, color: "var(--text2)" }}>Loading content coverage…</div>
        ) : coverageError ? (
          <div style={{ fontSize: 13, color: "var(--red)" }}>Couldn't load coverage stats. You can still generate per chapter below.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.chaptersDone} / {totals.chaptersTotal}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Chapters at target</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.q}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Questions</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.fc}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Flashcards</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totals.f}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Formulas</div>
            </div>
          </div>
        )}
      </div>

      <div className="chip-row mb-3" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CLASS_LEVELS.map((cl) => (
          <span
            key={cl}
            onClick={() => setClassLevel(cl)}
            style={{
              cursor: "pointer", padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: classLevel === cl ? "linear-gradient(135deg,var(--blue-mid),var(--purple))" : "var(--gray2)",
              color: classLevel === cl ? "#fff" : "var(--text2)",
            }}
          >
            {cl}
          </span>
        ))}
      </div>

      <div className="chip-row mb-4" style={{ display: "flex", gap: 8 }}>
        {SUBJECTS.map((s) => (
          <span
            key={s}
            onClick={() => setSubject(s)}
            className={`chip chip-${s === "Biology" ? "green" : s === "Physics" ? "blue" : "amber"}`}
            style={{ cursor: "pointer", opacity: subject === s ? 1 : 0.45, fontWeight: 700 }}
          >
            {s}
          </span>
        ))}
        <button className="btn btn-purple btn-sm" style={{ marginLeft: "auto" }} onClick={runAutoFill} disabled={autoFill?.running}>
          {autoFill?.running ? `Auto-filling ${classLevel}… (${autoFill.done}/${autoFill.total})` : `⚡ Auto-fill all of ${classLevel}`}
        </button>
      </div>

      {autoFill && (
        <div className="card mb-4" style={{ padding: 14, maxHeight: 180, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            {autoFill.running ? `Working… ${autoFill.done}/${autoFill.total}` : "Auto-fill finished"}
          </div>
          {autoFill.log.map((l, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--text2)", lineHeight: 1.6 }}>{l}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {chapters.map((chapter) => {
          const q = getCount(chapter, "question");
          const fc = getCount(chapter, "flashcard");
          const f = getCount(chapter, "formula");
          return (
            <div key={chapter} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", fontWeight: 600, fontSize: 13.5 }}>{chapter}</div>
              {[
                ["question", q, TARGETS_PER_CHAPTER.question],
                ["flashcard", fc, TARGETS_PER_CHAPTER.flashcard],
                ...(subject === "Biology" ? [] : [["formula", f, TARGETS_PER_CHAPTER.formula]]),
              ].map(([type, count, target]) => (
                <button
                  key={type}
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: `var(--${statusColor(count, target)})`, color: `var(--${statusColor(count, target)})` }}
                  onClick={() => openGenerate(chapter, type)}
                >
                  {TYPE_ICON[type]} {count}/{target} · Generate
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>
              {TYPE_ICON[modal.type]} {TYPE_LABEL[modal.type]} — {modal.chapter}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14 }}>{subject} · {classLevel}</div>

            {modal.loading && <div className="loading-screen" style={{ minHeight: 120 }}><div className="spinner"></div></div>}

            {modal.error && (
              <div style={{ background: "var(--red-light,#fee)", color: "var(--red)", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {modal.error}
              </div>
            )}

            {!modal.loading && modal.items.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {modal.items.map((item, i) => (
                  <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 8, background: "var(--gray2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!modal.checked[i]} onChange={() => toggleItem(i)} style={{ marginTop: 3 }} />
                    <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                      {modal.type === "question" && (
                        <>
                          <strong>{item.questionText}</strong>
                          <div style={{ color: "var(--text2)", marginTop: 4 }}>
                            A) {item.optionA}  B) {item.optionB}  C) {item.optionC}  D) {item.optionD}
                          </div>
                        </>
                      )}
                      {modal.type === "flashcard" && (
                        <>
                          <strong>{item.front}</strong>
                          <div style={{ color: "var(--text2)", marginTop: 4 }}>{item.back}</div>
                        </>
                      )}
                      {modal.type === "formula" && (
                        <>
                          <strong>{item.title}</strong>
                          <div style={{ color: "var(--text2)", marginTop: 4 }}>{item.expression}</div>
                        </>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!modal.loading && modal.items.length === 0 && !modal.error && (
              <p style={{ fontSize: 13, color: "var(--text2)" }}>No items generated — try again.</p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)} disabled={modal.saving}>Cancel</button>
              {!modal.loading && modal.items.length > 0 && (
                <button className="btn btn-purple btn-sm" onClick={saveModalItems} disabled={modal.saving}>
                  {modal.saving ? "Saving…" : `Save Selected (${Object.values(modal.checked).filter(Boolean).length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
