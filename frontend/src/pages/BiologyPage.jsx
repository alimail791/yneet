import { useState, useEffect } from "react";
import api from "../lib/api";

export default function BiologyFlashcardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [flipped, setFlipped] = useState({});

  useEffect(() => {
    api.get("/content/flashcards", { params: { subject: "Biology" } })
      .then(r => setCards(r.data.flashcards || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chapters = [...new Set(cards.map(c => c.chapter))];
  const filtered = cards.filter(c => !filter || c.chapter === filter);
  const toggle = (id) => setFlipped(f => ({ ...f, [id]: !f[id] }));

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-2">
        <div>
          <div className="section-title" style={{ fontSize: 22 }}>🧬 Biology Flashcards</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Chapter-wise, scoped to your class — tap a card to flip</p>
        </div>
        <span className="chip chip-green">{filtered.length} cards</span>
      </div>

      <div className="chip-row mb-6" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span
          onClick={() => setFilter("")}
          style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, transition: "all .15s", background: !filter ? "linear-gradient(135deg,var(--blue),var(--purple))" : "var(--gray2)", color: !filter ? "#fff" : "var(--text2)" }}
        >
          All Chapters
        </span>
        {chapters.map(c => (
          <span
            key={c}
            onClick={() => setFilter(c)}
            style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, transition: "all .15s", background: filter === c ? "linear-gradient(135deg,var(--blue),var(--purple))" : "var(--gray2)", color: filter === c ? "#fff" : "var(--text2)" }}
          >
            {c}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
        {filtered.map((c) => (
          <div key={c.id} className={`flashcard${flipped[c.id] ? " flipped" : ""}`} onClick={() => toggle(c.id)}>
            <div className="flashcard-inner">
              <div className="fc-face fc-front">
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, opacity: 0.75, marginBottom: 10 }}>{c.chapter}</div>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{c.front}</div>
                <div style={{ position: "absolute", bottom: 14, fontSize: 11, opacity: 0.7 }}>Tap to reveal answer</div>
              </div>
              <div className="fc-face fc-back">
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, opacity: 0.8, marginBottom: 10 }}>Answer</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{c.back}</div>
                <div style={{ position: "absolute", bottom: 14, fontSize: 11, opacity: 0.7 }}>Tap to see question</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card text-center" style={{ padding: 40 }}>
          <p style={{ color: "var(--text3)" }}>No flashcards yet for your class — check back soon.</p>
        </div>
      )}
    </div>
  );
}
