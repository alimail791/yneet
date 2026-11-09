import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
// Weightage plans run to exam day — open the week that contains today.
const currentWeek = (plan) => {
  const t = todayIST();
  const i = (plan?.weeks || []).findIndex((w) => w.days?.some((d) => d.date === t));
  return i >= 0 ? i : 0;
};

export default function PlannerPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [openWeek, setOpenWeek] = useState(0);
  const [rebuilding, setRebuilding] = useState(false);
  const navigate = useNavigate();
  const isWeightage = plan?.source === "weightage";

  const load = () => {
    setLoading(true);
    api.get("/planner").then(r => { setPlan(r.data.plan); setOpenWeek(currentWeek(r.data.plan)); }).finally(() => setLoading(false));
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
    const task = updated.weeks[weekIdx].days[dayIdx].tasks.find(t => t.id === taskId);
    // Weightage plans are large — tick one task instead of re-sending the whole plan.
    const req = isWeightage
      ? api.post("/weightage/plan/task", { taskId, done: !!task?.done })
      : api.post("/planner/save", { plan: updated });
    await req.catch(() => load()); // revert on failure
  };

  // Same exam date & hours; chapters whose practice task is ticked are kept as done.
  const rebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const { data } = await api.post("/weightage/plan", { examDate: plan.examDate, hoursPerDay: plan.hoursPerDay });
      setPlan(data.plan);
      setOpenWeek(currentWeek(data.plan));
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't rebuild the plan — try again shortly.");
    }
    setRebuilding(false);
  };

  const subjectColor = { Physics: "blue", Chemistry: "amber", Biology: "green", Mixed: "purple" };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-5">
        <div>
          <div className="section-title">🗓️ Study Planner</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            {isWeightage
              ? `Chapter-by-chapter plan to NEET on ${plan.examDate}, built from chapter weightage and your accuracy.`
              : "A personalized 4-week plan built from your profile — weak subjects, target score, and days left."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-purple" onClick={() => navigate("/weightage")}>🎯 {isWeightage ? "Change plan" : "Plan by chapter weightage"}</button>
          {isWeightage
            ? <button className="btn btn-outline" onClick={rebuild} disabled={rebuilding} title="Missed some days? Rebuild from today — finished chapters are kept.">{rebuilding ? "Rebuilding..." : "🔄 Rebuild from today"}</button>
            : <button className="btn btn-outline" onClick={generate} disabled={generating}>{generating ? "Generating..." : plan ? "🔄 Regenerate AI Plan" : "✨ Quick 4-week AI Plan"}</button>}
        </div>
      </div>

      {isWeightage && plan.chaptersNotFit > 0 && (
        <div className="card mb-5" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
          <p style={{ fontSize: 13.5 }}>
            {plan.chaptersNotFit} lower-priority chapter{plan.chaptersNotFit > 1 ? "s" : ""} didn't fit before the exam, so they only get a quick cover in revision. More study hours per day will make room.
          </p>
        </div>
      )}

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
            Build a day-by-day plan to exam day from <strong>Chapter Priority</strong> — high-weightage and weak chapters first, mocks every Sunday, revision at the end.
          </p>
          <button className="btn btn-purple" style={{ marginTop: 14 }} onClick={() => navigate("/weightage")}>🎯 Open Chapter Priority</button>
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: day.date === todayIST() ? "var(--purple, #7c3aed)" : "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                          {day.day}{day.date === todayIST() ? " · Today" : ""}
                        </div>
                        {day.tasks.map(task => (
                          <label key={task.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", cursor: "pointer" }}>
                            <input type="checkbox" checked={!!task.done} onChange={() => toggleTask(wi, di, task.id)} style={{ marginTop: 3 }} />
                            <span style={{ fontSize: 13.5, textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--text3)" : "var(--text)", flex: 1 }}>
                              {task.text}
                              {task.link && !task.done && (
                                <Link to={task.link} onClick={e => e.stopPropagation()} style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 600, color: "var(--blue)", whiteSpace: "nowrap" }}>Go →</Link>
                              )}
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
