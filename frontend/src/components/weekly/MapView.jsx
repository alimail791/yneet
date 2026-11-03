// One concept map, laid out for a phone: the core idea on top, then one card
// per branch. Used by the student page and the admin preview.
const ink = "#3b2fc9";

export default function MapView({ map, subject, chapter }) {
  if (!map) return null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: ink, color: "#fff", borderRadius: 18, padding: "18px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#c7d2fe" }}>{[subject, chapter].filter(Boolean).join(" · ").toUpperCase()}</p>
        <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>{map.center?.heading || map.title}</p>
        {map.center?.detail && <p style={{ fontSize: 15, color: "#e0e7ff" }}>{map.center.detail}</p>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {map.branches.map((b, i) => (
          <div key={i} style={{ background: i % 2 ? "#fef3c7" : "#fff", border: i % 2 ? "none" : `2px solid ${ink}`, borderRadius: 16, padding: "14px 16px" }}>
            <p style={{ fontWeight: 800, fontSize: 16, color: i % 2 ? "#451a03" : ink, marginBottom: 6 }}>{b.heading}</p>
            <ul style={{ paddingLeft: 18, display: "grid", gap: 4, fontSize: 14, color: "var(--text)", lineHeight: 1.45 }}>
              {b.points.map((p, k) => <li key={k}>{p}</li>)}
            </ul>
          </div>
        ))}
      </div>
      {map.remember && (
        <div style={{ background: "var(--green-light)", borderRadius: 14, padding: "12px 16px", fontSize: 14, color: "#064e3b", lineHeight: 1.5 }}>
          <strong>Remember:</strong> {map.remember}
        </div>
      )}
    </div>
  );
}
