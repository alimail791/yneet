import { useState, useEffect } from "react";
import api from "../lib/api";

const ACCENT = { Organic: "green", Inorganic: "blue", Physical: "amber" };
const accentGradient = (chapterKey) => {
  const c = ACCENT[chapterKey] || "blue";
  if (c === "green") return "linear-gradient(90deg,var(--green),#10b981)";
  if (c === "amber") return "linear-gradient(90deg,var(--amber),#f59e0b)";
  return "linear-gradient(90deg,var(--blue-mid),var(--purple))";
};

export default function ChemistryEquationsPage() {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/content/formulas", { params: { subject: "Chemistry" } })
      .then(r => setFormulas(r.data.formulas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chapters = [...new Set(formulas.map(f => f.chapter))];
  const filtered = formulas.filter(f =>
    (!filter || f.chapter === filter) &&
    (!search || f.title.toLowerCase().includes(search.toLowerCase()) || f.expression.toLowerCase().includes(search.toLowerCase()))
  );
  // Rough category bucket for the accent colour, based on keywords in the chapter name.
  const bucket = (chapter) => {
    const c = chapter.toLowerCase();
    if (c.includes("organic") || c.includes("hydrocarbon") || c.includes("alcohol") || c.includes("aldehyde") || c.includes("amine") || c.includes("haloalkane") || c.includes("biomolecule") || c.includes("polymer") || c.includes("everyday"))
      return "Organic";
    if (c.includes("s-block") || c.includes("p-block") || c.includes("d-") || c.includes("f-block") || c.includes("coordination") || c.includes("hydrogen") || c.includes("isolation"))
      return "Inorganic";
    return "Physical";
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header mb-2">
        <div>
          <div className="section-title" style={{ fontSize: 22 }}>🧪 Chemistry Hub</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Named reactions &amp; equations — chapter-wise, scoped to your class</p>
        </div>
        <span className="chip chip-amber">{filtered.length} entries</span>
      </div>

      <div style={{ position: "relative", marginBottom: 18 }}>
        <input
          className="form-input"
          style={{ width: "100%", paddingLeft: 36 }}
          placeholder="Search reaction name or equation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5, fontSize: 14 }}>🔍</span>
      </div>

      <div className="chip-row mb-6" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span
          onClick={() => setFilter("")}
          style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: !filter ? "linear-gradient(135deg,var(--amber),#f59e0b)" : "var(--gray2)", color: !filter ? "#fff" : "var(--text2)" }}
        >
          All Chapters
        </span>
        {chapters.map(c => (
          <span
            key={c}
            onClick={() => setFilter(c)}
            style={{ cursor: "pointer", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: filter === c ? "linear-gradient(135deg,var(--amber),#f59e0b)" : "var(--gray2)", color: filter === c ? "#fff" : "var(--text2)" }}
          >
            {c}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map((eq) => {
          const cat = bucket(eq.chapter);
          const color = ACCENT[cat];
          return (
            <div
              key={eq.id}
              className="formula-card"
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: accentGradient(cat) }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span className={`chip chip-${color}`}>{eq.chapter}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{eq.title}</div>
              <div style={{ background: "linear-gradient(135deg,var(--gray2),#f8fafc)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Courier New',monospace", fontSize: 13.5, marginBottom: 10, lineHeight: 1.6, overflowX: "auto", whiteSpace: "nowrap" }}>
                {eq.expression}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6 }}>{eq.notes}</div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card text-center" style={{ padding: 40, gridColumn: "1 / -1" }}>
            <p style={{ color: "var(--text3)" }}>No reactions yet for your class — check back soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
