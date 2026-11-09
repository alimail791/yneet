import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";

// Chapter Priority — NEET weightage map coloured by the student's own accuracy,
// sorted by "marks at risk", with one-tap practice and a plan builder.
const STATUS = {
  weak:   { label: "Weak",        color: "var(--red)",   bg: "var(--red-light)",   chip: "chip-red" },
  ok:     { label: "Getting there", color: "var(--amber)", bg: "var(--amber-light, #fff7e6)", chip: "chip-amber" },
  strong: { label: "Strong",      color: "var(--green)", bg: "var(--green-light, #e8f7ef)", chip: "chip-green" },
  new:    { label: "Not started", color: "var(--text3)", bg: "var(--gray2, #f3f4f6)", chip: "chip-blue" },
};
const SUBJECT_COLOR = { Physics: "var(--blue)", Chemistry: "var(--amber)", Biology: "var(--green)" };

export default function WeightagePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("All");
  const [sort, setSort] = useState("risk"); // risk | weight
  const [showPlan, setShowPlan] = useState(false);
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState(6);
  const [done, setDone] = useState(() => new Set());
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/weightage/map")
      .then(({ data }) => {
        setData(data);
        setExamDate(data.defaults?.examDate || "");
        setHours(data.defaults?.hoursPerDay || 6);
      })
      .catch(() => setError("Couldn't load your chapter map — try again shortly."))
      .finally(() => setLoading(false));
  }, []);

  const chapters = useMemo(() => {
    const list = (data?.chapters || []).filter((c) => subject === "All" || c.subject === subject);
    return sort === "weight" ? [...list].sort((a, b) => b.expectedQs - a.expectedQs) : list;
  }, [data, subject, sort]);

  const maxQs = Math.max(1, ...(data?.chapters || []).map((c) => c.expectedQs));
  const top5 = (data?.chapters || []).slice(0, 5);
  const top5Risk = Math.round(top5.reduce((a, c) => a + c.marksAtRisk, 0));
  const counts = (data?.chapters || []).reduce((a, c) => ({ ...a, [c.status]: (a[c.status] || 0) + 1 }), {});

  const toggleDone = (key) => setDone((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const buildPlan = async () => {
    setBuilding(true);
    setError(null);
    try {
      await api.post("/weightage/plan", { examDate, hoursPerDay: Number(hours), doneKeys: [...done] });
      navigate("/planner");
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't build the plan — try again.");
      setBuilding(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  if (data && !data.supported) {
    return (
      <div className="card text-center" style={{ padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h3>Chapter Priority is for Class 11, 12 & Dropper</h3>
        <p style={{ color: "var(--text2)", marginTop: 8 }}>
          Your class is set to {data.classLevel}. Keep building your foundation with Shorts, the Daily Quiz and Practice.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🎯 Chapter Priority</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            How many NEET questions each chapter is worth, and how many marks it's costing you right now.
          </p>
        </div>
        <button className="btn btn-purple" onClick={() => setShowPlan((v) => !v)}>
          🗓️ {showPlan ? "Hide plan builder" : "Build my study plan"}
        </button>
      </div>

      {error && (
        <div className="card mb-5" style={{ background: "var(--red-light)", color: "var(--red)" }}>
          <p style={{ fontSize: 13.5 }}>{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid2 mb-5">
        <div className="card">
          <div className="card-title">Marks at risk in your top 5 chapters</div>
          <div className="card-value" style={{ color: "var(--red)" }}>~{top5Risk}</div>
          <div className="card-sub">Fix these first: {top5.map((c) => c.chapter).slice(0, 3).join(", ")}</div>
        </div>
        <div className="card">
          <div className="card-title">Your chapters</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {["weak", "ok", "strong", "new"].map((s) => (
              <span key={s} className={`chip ${STATUS[s].chip}`}>{STATUS[s].label}: {counts[s] || 0}</span>
            ))}
          </div>
          <div className="card-sub" style={{ marginTop: 8 }}>
            Colours come from your Practice and Mock Test answers (5+ questions per chapter).
          </div>
        </div>
      </div>

      {/* Plan builder */}
      {showPlan && (
        <div className="card mb-5">
          <div className="section-title mb-3">Build a day-by-day plan to exam day</div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
            High-weightage and weak chapters come first. Sundays are full mock tests, and the last 30 days are revision.
            Building a new plan replaces your current planner.
          </p>
          <div className="grid2">
            <div className="form-group">
              <label className="form-label">NEET exam date</label>
              <input className="form-input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 4 }}>Expected date — update it when NTA announces the official one.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Study hours per day</label>
              <input className="form-input" type="number" min="2" max="14" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div className="form-label" style={{ marginTop: 6 }}>Tick chapters you've already finished (they'll go straight to revision):</div>
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--gray3)", borderRadius: 8, padding: "6px 10px", marginBottom: 14 }}>
            {["Physics", "Chemistry", "Biology"].map((s) => (
              <div key={s}>
                <div style={{ fontSize: 12, fontWeight: 700, color: SUBJECT_COLOR[s], margin: "8px 0 4px" }}>{s}</div>
                {(data?.chapters || []).filter((c) => c.subject === s).map((c) => {
                  const k = `${c.subject}|${c.key}`;
                  return (
                    <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 13.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={done.has(k)} onChange={() => toggleDone(k)} />
                      {c.chapter}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <button className="btn btn-purple" onClick={buildPlan} disabled={building || !examDate}>
            {building ? "Building..." : `✨ Build plan (${(data?.chapters?.length || 0) - done.size} chapters)`}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="chip-filter-row mb-3" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {["All", "Physics", "Chemistry", "Biology"].map((s) => (
          <button key={s} className={`btn btn-sm ${subject === s ? "btn-blue" : "btn-outline"}`} onClick={() => setSubject(s)}>{s}</button>
        ))}
        <select className="form-select" style={{ width: "auto", marginLeft: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="risk">Sort: marks at risk</option>
          <option value="weight">Sort: NEET weightage</option>
        </select>
      </div>

      {/* Chapter list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {chapters.map((c, i) => {
          const st = STATUS[c.status];
          return (
            <div key={`${c.subject}|${c.key}`} className="card" style={{ padding: 14, borderLeft: `4px solid ${st.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: SUBJECT_COLOR[c.subject] }}>
                    {sort === "risk" && subject === "All" ? `#${i + 1} · ` : ""}{c.subject} · Class {c.classLevel.replace("th", "")}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2 }}>{c.chapter}</div>
                </div>
                <span className={`chip ${st.chip}`} style={{ whiteSpace: "nowrap" }}>
                  {c.accuracy == null || c.status === "new" ? st.label : `${c.accuracy}%`}
                </span>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="subj-row" style={{ fontSize: 12.5 }}>
                  <span>~{c.expectedQs} Qs per paper ({c.expectedMarks} marks)</span>
                  <span style={{ color: c.marksAtRisk >= 8 ? "var(--red)" : "var(--text2)", fontWeight: 600 }}>~{Math.round(c.marksAtRisk)} marks at risk</span>
                </div>
                <div className="prog-bar"><div className="prog-fill" style={{ width: `${(c.expectedQs / maxQs) * 100}%`, background: SUBJECT_COLOR[c.subject] }}></div></div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Link className="btn btn-sm btn-blue" to={`/practice?subject=${encodeURIComponent(c.subject)}&chapter=${encodeURIComponent(c.practiceChapter)}`}>
                  ✍️ Practice{c.practiceCount ? ` (${c.practiceCount})` : ""}
                </Link>
                {c.pyqCount > 0 && (
                  <Link className="btn btn-sm btn-outline" to={`/practice?subject=${encodeURIComponent(c.subject)}&chapter=${encodeURIComponent(c.pyqChapter)}&pyq=1`}>
                    📅 PYQs ({c.pyqCount})
                  </Link>
                )}
                {c.attempted > 0 && <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center" }}>{c.attempted} answered</span>}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 16 }}>
        Weightage is the approximate average from recent NEET papers
        {data?.pyqYearsUsed ? `, adjusted with ${data.pyqYearsUsed} years of PYQs in the YNeet bank` : ""}. Actual papers vary year to year.
      </p>
    </div>
  );
}
