import { useState, useEffect } from "react";
import api from "../../lib/api";
import { CLASS_LEVELS } from "../../utils/curriculum";

const POOL_STATS_URL = "/admin/mock-builder/pool-stats";
const BUILD_URL = "/admin/mock-builder/build";

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
    </div>
  );
}
