import { useEffect, useState } from "react";
import api from "../lib/api";

export default function PlannerPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [openWeek, setOpenWeek] = useState(0);

  const load = () => {
    setLoading(true);
    api.get("/planner").then(r => setPlan(r.data.plan)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/planner/generate");
      setPlan(data.plan);
      setOpenWeek(0);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't generate a plan right now — try again shortly.");
    }
    setGenerating(false);
  };

  const toggleTask = async (weekIdx, dayIdx, taskId) => {
    const updated = {
      ...plan,
      weeks: plan.weeks.map((w, wi) => wi !== weekIdx ? w : {
        ...w,
        days: w.days.map((d, di) => di !== dayIdx ? d : {
          ...d,
          tasks: d.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t),
        }),
      }),
    };
    setPlan(updated); // optimistic
    await api.post("/planner/save", { plan: updated }).catch(() => load()); // revert on failure
  };

  const subjectColor = { Physics: "blue", Chemistry: "amber", Biology: "green", Mixed: "purple" };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🗓️ Study Planner</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>A personalized 4-week plan built from your profile — weak subjects, target score, and days left.</p>
        </div>
        <button className="btn btn-purple" onClick={generate} disabled={generating}>
          {generating ? "Generating..." : plan ? "🔄 Regenerate Plan" : "✨ Generate My Plan"}
        </button>
      </div>

      {error && (
        <div className="card mb-5" style={{ background: "var(--red-light)", color: "var(--red)" }}>
          <p style={{ fontSize: 13.5 }}>{error}</p>
        </div>
      )}

      {!plan && !generating && !error && (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3>No study plan yet</h3>
          <p style={{ color: "var(--text2)", marginTop: 8, marginBottom: 4 }}>
            Make sure your Profile has your target score, weak subjects, and study hours filled in first — the plan is built around them.
          </p>
        </div>
      )}

      {generating && !plan && (
        <div className="card text-center" style={{ padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto 14px" }}></div>
          <p style={{ color: "var(--text2)" }}>Building your personalized 4-week plan...</p>
        </div>
      )}

      {plan?.weeks && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {plan.weeks.map((week, wi) => {
            const allTasks = week.days.flatMap(d => d.tasks);
            const doneCount = allTasks.filter(t => t.done).length;
            const isOpen = openWeek === wi;
            return (
              <div key={wi} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  onClick={() => setOpenWeek(isOpen ? -1 : wi)}
                  style={{ padding: 18, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Week {week.weekNumber}</div>
                    <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{week.focus}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="chip chip-green">{doneCount}/{allTasks.length} done</span>
                    <span style={{ fontSize: 18, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--gray3)", padding: "8px 18px 18px" }}>
                    {week.days.map((day, di) => (
                      <div key={di} style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{day.day}</div>
                        {day.tasks.map(task => (
                          <label key={task.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer" }}>
                            <input type="checkbox" checked={!!task.done} onChange={() => toggleTask(wi, di, task.id)} style={{ marginTop: 3 }} />
                            <span style={{ fontSize: 13.5, textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--text3)" : "var(--text)", flex: 1 }}>
                              {task.text}
                            </span>
                            <span className={`chip chip-${subjectColor[task.subject] || "blue"}`} style={{ fontSize: 10.5 }}>{task.subject}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
