// "Today" card at the top of the dashboard. Answers three questions at a glance:
// what should I do now, how much have I done today, where am I losing marks.
// Data: /dashboard -> today (backend/src/utils/studyPlan.js todayPlan()).
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../lib/api";

const subjColor = (s) => (s === "Physics" ? "var(--blue)" : s === "Chemistry" ? "var(--amber)" : "var(--green)");

export default function TodayPlan({ today, name }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  if (!today) return null;

  const { target, doneToday, resume, lastResult, weakChapters, nextTest, mistakes, primary } = today;
  const pct = Math.min(100, Math.round((doneToday / Math.max(1, target)) * 100));

  const startTest = async (testId) => {
    setStarting(true);
    try {
      const { data } = await api.post(`/mock/${testId}/start`);
      navigate(`/mock/${data.attempt.id}/start`);
    } catch (err) {
      alert(err?.response?.data?.message || "Couldn't start the test. Please try again.");
      setStarting(false);
    }
  };

  const go = () => {
    if (primary.kind === "resume") navigate(`/mock/${primary.attemptId}/start`);
    else if (primary.kind === "test") startTest(primary.testId);
    else navigate(primary.to);
  };

  return (
    <section className="card today-plan" aria-labelledby="today-plan-h">
      <div className="today-head">
        <div>
          <h2 id="today-plan-h" className="today-title">{name ? `${name}, here's today` : "Today"}</h2>
          <p className="today-sub">
            {doneToday >= target ? `Target done: ${doneToday} questions today 🎉` : `${doneToday} of ${target} questions today`}
          </p>
        </div>
        <div className="today-ring" style={{ "--pct": pct }} aria-label={`${pct}% of today's target`}><span>{pct}%</span></div>
      </div>

      <button type="button" className="btn btn-blue today-cta" onClick={go} disabled={starting}>
        {starting ? "Starting…" : primary.label} →
      </button>
      {resume && (
        <p className="today-note">{resume.title}: {Math.floor(resume.secsLeft / 60)} min left. Your answers are saved.</p>
      )}

      <div className="today-grid">
        <div className="today-block">
          <div className="today-label">Where you're losing marks</div>
          {weakChapters.length ? (
            <ul className="today-list">
              {weakChapters.map((c) => (
                <li key={`${c.subject}-${c.chapter}`}>
                  <Link to={c.to}>
                    <span style={{ color: subjColor(c.subject), fontWeight: 700 }}>{c.chapter}</span>
                    <span className="today-acc">{c.accuracy}% · {c.correct}/{c.total}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="today-empty">Take a test or practise a few chapters and we'll show your weak spots here.</p>
          )}
        </div>

        <div className="today-block">
          <div className="today-label">Next test</div>
          {nextTest ? (
            <button type="button" className="today-link-btn" onClick={() => startTest(nextTest.id)} disabled={starting}>
              {nextTest.title} <span className="today-acc">{nextTest.totalQs} Qs · {nextTest.durationMin} min</span>
            </button>
          ) : (
            <Link to="/mock">See all tests</Link>
          )}
          {lastResult && (
            <>
              <div className="today-label" style={{ marginTop: 12 }}>Last test</div>
              <Link to={`/mock/${lastResult.attemptId}/analysis`}>
                {lastResult.title}: <b>{lastResult.score}/{lastResult.totalMarks}</b> <span className="today-acc">see what to fix →</span>
              </Link>
            </>
          )}
          {mistakes > 0 && (
            <>
              <div className="today-label" style={{ marginTop: 12 }}>Mistake notebook</div>
              <Link to="/mistakes">{mistakes} question{mistakes === 1 ? "" : "s"} to revise →</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
