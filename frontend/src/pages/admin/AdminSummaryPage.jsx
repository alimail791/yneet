import { useEffect, useState } from "react";
import api from "../../lib/api";

export default function AdminSummaryPage() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/admin/summary").then(r => setSummary(r.data.summary)).catch(() => {});
  }, []);

  const cards = summary ? [
    { label: "Total YNeet Users", value: summary.totalUsers, color: "blue" },
    { label: "Active Subscriptions", value: summary.activeSubs, color: "green" },
    { label: "Questions", value: summary.totalQuestions, color: "purple" },
    { label: "Flashcards", value: summary.totalFlashcards, color: "amber" },
    { label: "Formulas", value: summary.totalFormulas, color: "blue" },
  ] : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Overview</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {cards.map(c => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{c.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: `var(--${c.color})`, marginTop: 6 }}>{c.value ?? "—"}</div>
          </div>
        ))}
        {!summary && <div className="card">Loading...</div>}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>Quick links</p>
        <ul style={{ fontSize: 14, color: "var(--text2)", lineHeight: 2 }}>
          <li><a href="/admin/users" style={{ color: "var(--blue-mid)" }}>View all enrolled users &amp; subscription status →</a></li>
          <li><a href="/admin/questions" style={{ color: "var(--blue-mid)" }}>Add or edit questions (mock tests / quiz / practice) →</a></li>
          <li><a href="/admin/flashcards" style={{ color: "var(--blue-mid)" }}>Add or edit flashcards →</a></li>
          <li><a href="/admin/formulas" style={{ color: "var(--blue-mid)" }}>Add or edit formulas / named reactions →</a></li>
        </ul>
      </div>
    </div>
  );
}
