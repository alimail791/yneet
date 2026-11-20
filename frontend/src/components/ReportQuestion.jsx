import { useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";

// "Report an error in this question" — shown after the answer is revealed
// (Practice, PYQs, Mistakes). Sent to POST /question-reports, which forwards it
// to the admin's question-report list on www.yneet.in.
const REASONS = [
  ["wrong_answer", "The answer is wrong"],
  ["wrong_explanation", "The explanation is wrong or unclear"],
  ["question_error", "Mistake in the question"],
  ["options_error", "Mistake in the options"],
  ["other", "Something else"],
];

export default function ReportQuestion({ questionId }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [msg, setMsg] = useState("");
  if (!questionId) return null;

  const send = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setState("sending");
    try {
      await api.post("/question-reports", { questionId, reason, note, page: pathname });
      setState("done");
    } catch (err) {
      setState("error");
      setMsg(err?.response?.data?.message || "Couldn't send. Please try again.");
    }
  };

  if (state === "done") return <p style={{ fontSize: 12, color: "var(--green, #059669)", fontWeight: 600, margin: "6px 0 10px" }}>✓ Thanks! We'll check this question and fix it.</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ background: "none", border: 0, padding: 0, margin: "2px 0 10px", fontSize: 12, color: "var(--text2)", cursor: "pointer", textDecoration: "underline" }}>
        🚩 Report an error in this question
      </button>
    );
  }

  return (
    <form onSubmit={send} style={{ margin: "6px 0 12px", border: "1px solid var(--gray3, #d1d5db)", borderRadius: 10, padding: 12, fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>What's wrong with this question?</div>
      {REASONS.map(([k, label]) => (
        <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}>
          <input type="radio" name={`rq-${questionId}`} checked={reason === k} onChange={() => setReason(k)} /> {label}
        </label>
      ))}
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2}
        placeholder="Tell us more (optional), e.g. the correct answer is (C) because…"
        style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid var(--gray3, #d1d5db)", fontSize: 13, fontFamily: "inherit", background: "transparent", color: "var(--text)" }} />
      {state === "error" && <p style={{ color: "var(--red, #dc2626)", fontSize: 12, marginTop: 6 }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!reason || state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
