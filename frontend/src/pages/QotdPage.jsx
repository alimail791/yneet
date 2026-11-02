// Question of the Day inside the app — what the 7 AM notification opens.
// Answer, see the explanation, then share it with a friend (each share links to
// the public Question of the Day page on yneet.in, which invites sign-ups).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

const SHARE_URL = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "") + "/neet-question-of-the-day";

export default function QotdPage() {
  const [q, setQ] = useState(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    api.get("/public/qotd").then((r) => setQ(r.data.today)).catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="loading-screen"><p>Couldn't load today's question. <Link to="/">Go home</Link></p></div>;
  if (!q) return <div className="loading-screen"><div className="spinner"></div></div>;

  const correct = q.answer - 1; // public API is 1-based
  const answered = picked !== null;
  const shareText = `Can you solve today's NEET Question of the Day? 🧠\n\n${q.question}\n\nTry it on YNeet: ${SHARE_URL}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link to="/" style={{ fontSize: 14, color: "var(--blue-mid)", fontWeight: 600 }}>← Home</Link>
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "var(--green)", background: "var(--green-light)", padding: "3px 10px", borderRadius: 10 }}>Question of the Day #{q.number}</span>
            <span style={{ color: "var(--text3)" }}>{q.subject} · {q.chapter}{q.pyqYear ? ` · NEET ${q.pyqYear}` : ""}</span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 14, whiteSpace: "pre-line" }}>{q.question}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {q.options.map((o, i) => {
              let bg = "#fff", border = "var(--gray3)";
              if (answered && i === correct) { bg = "var(--green-light)"; border = "var(--green)"; }
              else if (answered && i === picked) { bg = "var(--red-light)"; border = "var(--red)"; }
              return (
                <button key={i} disabled={answered} onClick={() => setPicked(i)}
                  style={{ textAlign: "left", padding: "12px 14px", minHeight: 48, borderRadius: 12, border: `2px solid ${border}`, background: bg, fontSize: 15, cursor: answered ? "default" : "pointer", color: "var(--text)" }}>
                  <strong style={{ marginRight: 8 }}>{"ABCD"[i]}.</strong>{o}
                </button>
              );
            })}
          </div>
          {answered && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 800, color: picked === correct ? "var(--green)" : "var(--red)", marginBottom: 6 }}>
                {picked === correct ? "Correct! 🎉" : `Not quite. The answer is ${"ABCD"[correct]}.`}
              </p>
              {q.explanation && <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{q.explanation}</p>}
            </div>
          )}
        </div>
        {answered && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <a className="btn btn-blue" style={{ justifyContent: "center", textAlign: "center", background: "#047857" }}
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
              Challenge a friend on WhatsApp
            </a>
            <Link className="btn btn-outline" style={{ justifyContent: "center", textAlign: "center" }} to="/">Keep practising</Link>
          </div>
        )}
      </div>
    </div>
  );
}
