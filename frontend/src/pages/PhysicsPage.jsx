import { useState, useEffect } from "react";
import api from "../lib/api";

export default function PhysicsFormulasPage() {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [bookmarked, setBookmarked] = useState({});

  useEffect(() => {
    api.get("/content/formulas", { params: { subject: "Physics" } })
      .then(r => setFormulas(r.data.formulas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chapters = [...new Set(formulas.map(f => f.chapter))];
  const filtered = formulas.filter(f =>
    (!filter || f.chapter === filter) &&
    (!search || f.title.toLowerCase().includes(search.toLowerCase()) || f.expression.toLowerCase().includes(search.toLowerCase()))
  );
  const toggleBookmark = (id) => setBookmarked(b => ({ ...b, [id]: !b[id] }));

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-2">
        <div>
          <div className="section-title" style={{ fontSize: 22 }}>⚛️ Physics Formula Hub</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Chapter-wise, scoped to your class syllabus</p>
        </div>
        <span className="chip chip-blue">{filtered.length} formulas</span>
      </div>

      <div style={{ position: "relative", marginBottom: 18 }}>
        <input
          className="form-input"
          style={{ width: "100%", paddingLeft: 36 }}
          placeholder="Search formula or equation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5, fontSize: 14 }}>🔍</span>
      </div>

      <div className="chip-row mb-6" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span
          onClick={() => setFilter("")}
          style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, transition: "all .15s", background: !filter ? "linear-gradient(135deg,var(--blue-mid),var(--purple))" : "var(--gray2)", color: !filter ? "#fff" : "var(--text2)" }}
        >
          All Chapters
        </span>
        {chapters.map(c => (
          <span
            key={c}
            onClick={() => setFilter(c)}
            style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, transition: "all .15s", background: filter === c ? "linear-gradient(135deg,var(--blue-mid),var(--purple))" : "var(--gray2)", color: filter === c ? "#fff" : "var(--text2)" }}
          >
            {c}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
        {filtered.map((f) => (
          <div key={f.id} className="formula-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: "var(--blue-mid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{f.chapter}</div>
              <button
                onClick={() => toggleBookmark(f.id)}
                style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", lineHeight: 1 }}
                aria-label="Bookmark"
              >
                {bookmarked[f.id] ? "⭐" : "☆"}
              </button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{f.title}</div>
            <div className="formula-eq">{f.expression}</div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>{f.notes}</div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card text-center" style={{ padding: 40 }}>
          <p style={{ color: "var(--text3)" }}>No formulas yet for your class — check back soon.</p>
        </div>
      )}
    </div>
  );
}
