import { useState, useEffect, useRef } from "react";
import ChapterTestsPanel from "./ChapterTestsPanel";
import api from "../../lib/api";
import { CLASS_LEVELS } from "../../utils/curriculum";

const POOL_STATS_URL = "/admin/mock-builder/pool-stats";
const BUILD_URL = "/admin/mock-builder/build";
const BULK_BUILD_URL = "/admin/mock-builder/bulk-build";
const BULK_STATUS_URL = "/admin/mock-builder/bulk-status";

// Mirrors backend/src/controllers/mockBuilderController.js buildDefaultSpec() —
// kept here only to show the admin what "Run the Oct 2026 batch" is about to
// create before they click it. The backend is the source of truth; if the
// counts there change, update this table too.
const BULK_BATCH_TABLE = [
  { classLevel: "Dropper", full: 30, half: 50, subjPhysics: 30, subjChemistry: 30, subjBiology: 60, daily: 200 },
  { classLevel: "12th", full: 10, half: 30, subjPhysics: 20, subjChemistry: 20, subjBiology: 40, daily: 100 },
  { classLevel: "11th", full: 10, half: 30, subjPhysics: 20, subjChemistry: 20, subjBiology: 40, daily: 100 },
];
const bulkRowTotal = (r) => r.full + r.half + r.subjPhysics + r.subjChemistry + r.subjBiology + r.daily;
const BULK_BATCH_TOTAL = BULK_BATCH_TABLE.reduce((sum, r) => sum + bulkRowTotal(r), 0);

// Presets covering the common paper shapes you'd actually want to generate.
const PRESETS = [
  { label: "Full NEET Mock (180Q)", duration: 180, counts: { Physics: 45, Chemistry: 45, Biology: 90 } },
  { label: "Half Mock (90Q)", duration: 90, counts: { Physics: 22, Chemistry: 22, Biology: 46 } },
  { label: "Subject Test — Physics (45Q)", duration: 45, counts: { Physics: 45, Chemistry: 0, Biology: 0 } },
  { label: "Subject Test — Chemistry (45Q)", duration: 45, counts: { Physics: 0, Chemistry: 45, Biology: 0 } },
  { label: "Subject Test — Biology (45Q)", duration: 45, counts: { Physics: 0, Chemistry: 0, Biology: 45 } },
  { label: "Daily Practice Quiz (20Q)", duration: 20, counts: { Physics: 7, Chemistry: 6, Biology: 7 } },
];

export default function MockTestBuilderPage() {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(180);
  // classLevel: the single label this test is tagged with (shown in the student's
  // Mock Tests list). poolClassLevels: which classes' question pools to draw from —
  // e.g. a "12th" or "Dropper" test should usually pull from both 11th and 12th,
  // since that's the real NEET syllabus split.
  const [classLevel, setClassLevel] = useState("12th");
  const [poolClassLevels, setPoolClassLevels] = useState(["11th", "12th"]);
  const [counts, setCounts] = useState({ Physics: 45, Chemistry: 45, Biology: 90 });
  const [poolStats, setPoolStats] = useState(null);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [bulkJob, setBulkJob] = useState(null);
  const [bulkError, setBulkError] = useState(null);
  const pollRef = useRef(null);

  const pollBulkStatus = () => {
    api.get(BULK_STATUS_URL).then((r) => {
      setBulkJob(r.data.job);
      if (!r.data.job || !r.data.job.running) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }).catch(() => {});
  };

  useEffect(() => {
    // Pick up an already-running job on page load (e.g. admin navigated away
    // and came back), and clean up polling on unmount.
    api.get(BULK_STATUS_URL).then((r) => {
      setBulkJob(r.data.job);
      if (r.data.job?.running && !pollRef.current) {
        pollRef.current = setInterval(pollBulkStatus, 2000);
      }
    }).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, []);

  const startBulkBuild = async () => {
    setBulkError(null);
    try {
      const { data } = await api.post(BULK_BUILD_URL, {});
      setBulkJob(data.job);
      if (!pollRef.current) pollRef.current = setInterval(pollBulkStatus, 2000);
    } catch (err) {
      setBulkError(err?.response?.data?.message || "Failed to start the bulk build.");
    }
  };

  const deleteOldBatch = async () => {
    try {
      const { data: d } = await api.get("/admin/mock-builder/old-batch");
      if (!d.tests) { alert("No previously generated bulk tests found."); return; }
      const cls = Object.entries(d.byClass).map(([c, n]) => `${c}: ${n}`).join(", ");
      const warn = d.attempts ? `\n\n⚠️ ${d.attempts} student attempt(s) on ${d.testsWithAttempts} of these tests will be deleted too.` : "\n\nNo student has attempted any of them.";
      if (!window.confirm(`Delete ${d.tests} previously generated tests (${cls})?${warn}\n\nYour original tests (the ones not made by the bulk generator) are not touched. Questions are not deleted.`)) return;
      const { data: r } = await api.post("/admin/mock-builder/old-batch/delete");
      alert(`Deleted ${r.deleted} tests${r.attemptsDeleted ? ` and ${r.attemptsDeleted} attempts` : ""}. You can now run the new batch.`);
    } catch (err) { alert(err?.response?.data?.message || "Delete failed"); }
  };

  const togglePoolClass = (cl) => {
    setPoolClassLevels((prev) => (prev.includes(cl) ? prev.filter((x) => x !== cl) : [...prev, cl]));
  };

  useEffect(() => {
    if (poolClassLevels.length === 0) { setPoolStats(null); return; }
    api
      .get(`${POOL_STATS_URL}?classLevels=${poolClassLevels.join(",")}`)
      .then((r) => setPoolStats(r.data.stats))
      .catch(() => setPoolStats(null));
  }, [poolClassLevels]);

  const applyPreset = (preset) => {
    setDuration(preset.duration);
    setCounts(preset.counts);
    if (!title) setTitle(preset.label.replace(/\s*\(.*\)$/, ""));
  };

  const totalQuestions = Object.values(counts).reduce((a, b) => a + Number(b || 0), 0);

  const build = async () => {
    setError(null);
    setResult(null);
    if (!title.trim()) return setError("Give the test a title.");
    if (poolClassLevels.length === 0) return setError("Pick at least one class level to draw questions from.");
    if (totalQuestions === 0) return setError("Set at least one subject's question count above zero.");
    setBuilding(true);
    try {
      const { data } = await api.post(BUILD_URL, {
        title: title.trim(),
        durationMin: Number(duration),
        classLevel,
        poolClassLevels,
        counts,
      });
      setResult(data);
      setTitle("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to build the test — try again.");
    }
    setBuilding(false);
  };

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🧪 Mock Test Auto-Builder</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            Assembles a full test paper from your question bank in one click — chapter-balanced, not just random.
          </p>
        </div>
      </div>

      <div className="chip-row mb-5" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {PRESETS.map((p) => (
          <span
            key={p.label}
            onClick={() => applyPreset(p)}
            style={{ cursor: "pointer", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "var(--gray2)", color: "var(--text2)" }}
          >
            {p.label}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>Test Title</label>
          <input className="form-input" style={{ width: "100%", marginTop: 4 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NEET Full Mock Test #12" />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>Duration (minutes)</label>
            <input type="number" className="form-input" style={{ width: 140, marginTop: 4 }} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>List under class</label>
            <select className="form-input" style={{ width: 140, marginTop: 4 }} value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
              {CLASS_LEVELS.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>Draw questions from classes</label>
          <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {CLASS_LEVELS.map((cl) => (
              <span
                key={cl}
                onClick={() => togglePoolClass(cl)}
                style={{
                  cursor: "pointer", padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700,
                  background: poolClassLevels.includes(cl) ? "linear-gradient(135deg,var(--blue-mid),var(--purple))" : "var(--gray2)",
                  color: poolClassLevels.includes(cl) ? "#fff" : "var(--text2)",
                }}
              >
                {cl}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            Tip: a Dropper or Class 12 mock should usually include both 11th and 12th — that's the real NEET syllabus split.
          </p>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}>Questions per subject</label>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {["Physics", "Chemistry", "Biology"].map((s) => (
              <div key={s}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>
                  {s} {poolStats && <span>· {poolStats[s] ?? 0} available</span>}
                </div>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 90 }}
                  value={counts[s]}
                  onChange={(e) => setCounts((c) => ({ ...c, [s]: Number(e.target.value) }))}
                />
                {poolStats && Number(counts[s]) > (poolStats[s] ?? 0) && (
                  <div style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 2 }}>only {poolStats[s] ?? 0} in pool</div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 8 }}>Total: <strong>{totalQuestions}</strong> questions</p>
        </div>

        {error && <div style={{ background: "var(--red-light,#fee)", color: "var(--red)", padding: 10, borderRadius: 8, fontSize: 13 }}>{error}</div>}

        {result && (
          <div style={{ background: "var(--green-light)", color: "var(--green)", padding: 10, borderRadius: 8, fontSize: 13 }}>
            ✅ Built "{result.mockTest?.title}" with {result.questionCount} questions.
            {result.shortfalls && Object.keys(result.shortfalls).length > 0 && (
              <div style={{ marginTop: 6, color: "var(--amber)" }}>
                {Object.entries(result.shortfalls).map(([sub, s]) => (
                  <div key={sub}>⚠️ {sub}: wanted {s.requested}, only {s.available} were available in the pool.</div>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-purple" onClick={build} disabled={building}>
          {building ? "Building…" : "🏗️ Build Mock Test"}
        </button>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 24, maxWidth: 640 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>📦 Bulk-Generate the Oct 2026 Batch</div>
        <p style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 12 }}>
          Builds {BULK_BATCH_TOTAL} tests in one background job — full mocks, half mocks, single-subject
          tests, and daily practice sets for Dropper, 12th and 11th. Dropper pulls questions from the
          11th + 12th + Dropper pools combined; 11th and 12th each draw only from their own class. Picks
          are chapter-balanced and rotate through the whole pool before any question repeats, so reuse
          spreads evenly instead of clustering on the same subset.
        </p>

        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text3)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px" }}>Class</th>
                <th style={{ padding: "4px 8px" }}>Full (180)</th>
                <th style={{ padding: "4px 8px" }}>Half (90)</th>
                <th style={{ padding: "4px 8px" }}>Phy (45)</th>
                <th style={{ padding: "4px 8px" }}>Chem (45)</th>
                <th style={{ padding: "4px 8px" }}>Bio (45)</th>
                <th style={{ padding: "4px 8px" }}>Daily (20)</th>
                <th style={{ padding: "4px 8px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {BULK_BATCH_TABLE.map((r) => (
                <tr key={r.classLevel} style={{ borderTop: "1px solid var(--gray2)" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700 }}>{r.classLevel}</td>
                  <td style={{ padding: "6px 8px" }}>{r.full}</td>
                  <td style={{ padding: "6px 8px" }}>{r.half}</td>
                  <td style={{ padding: "6px 8px" }}>{r.subjPhysics}</td>
                  <td style={{ padding: "6px 8px" }}>{r.subjChemistry}</td>
                  <td style={{ padding: "6px 8px" }}>{r.subjBiology}</td>
                  <td style={{ padding: "6px 8px" }}>{r.daily}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 700 }}>{bulkRowTotal(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bulkError && <div style={{ background: "var(--red-light,#fee)", color: "var(--red)", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{bulkError}</div>}

        {bulkJob && (
          <div className="card" style={{ background: "var(--gray2)", padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {bulkJob.running
                ? `Building… ${bulkJob.done}/${bulkJob.total} tests (${bulkJob.failed} failed)`
                : `Finished — ${bulkJob.done}/${bulkJob.total} tests created${bulkJob.failed ? `, ${bulkJob.failed} failed` : ""}`}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--gray3,#e2e2e2)", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ height: "100%", width: `${bulkJob.total ? Math.round((bulkJob.done / bulkJob.total) * 100) : 0}%`, background: "var(--blue-mid)" }} />
            </div>
            {bulkJob.log?.length > 0 && (
              <div style={{ maxHeight: 160, overflowY: "auto", fontSize: 11.5, color: "var(--text2)", lineHeight: 1.6 }}>
                {bulkJob.log.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
            {!bulkJob.running && bulkJob.shortfalls?.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--amber)" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Pool was smaller than total demand (questions got reused):</div>
                {bulkJob.shortfalls.map((s, i) => (
                  <div key={i}>
                    ⚠️ {s.subject} ({s.poolClassLevels.join("+")}): {s.poolSize} questions in pool, {s.totalSlotsRequested} question-slots requested
                    {s.avgReusePerQuestion ? ` — each question reused ~${s.avgReusePerQuestion}× on average` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-outline" style={{ marginRight: 10 }} onClick={deleteOldBatch} disabled={bulkJob?.running}>
          🗑 Delete previous batch
        </button>
        <button className="btn btn-purple" onClick={startBulkBuild} disabled={bulkJob?.running}>
          {bulkJob?.running ? `Building… (${bulkJob.done}/${bulkJob.total})` : `📦 Run the Oct 2026 batch (${BULK_BATCH_TOTAL} tests)`}
        </button>
      </div>
      <ChapterTestsPanel />
    </div>
  );
}
