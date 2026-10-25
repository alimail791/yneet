import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PUZZLES_URL } from "../utils/plan";

// Home for the free Class 6–8 tier: today's puzzles, the daily quiz and Shorts,
// plus a heads-up about NEET Foundation for when they reach Class 9.
export default function JuniorHomePage() {
  const { user } = useAuth();
  const first = user?.name?.split(" ")[0] || "there";
  const streak = user?.streak?.current || 0;
  const cls = user?.profile?.class;

  const cards = [
    { href: PUZZLES_URL, icon: "🧩", title: "Today's puzzles", desc: "5 quick science puzzles. A new set every day.", cta: "Play now ↗", color: "var(--purple)" },
    { to: "/quiz", icon: "⚡", title: "Daily quiz", desc: `20 questions from your Class ${cls?.replace("th", "") || ""} syllabus.`, cta: "Start quiz", color: "var(--blue-mid)" },
    { to: "/shorts", icon: "🎬", title: "Shorts", desc: "Learn one concept in 3–5 minutes, then a quick check.", cta: "Watch", color: "var(--green)" },
  ];

  return (
    <div>
      <div className="motiv-card">
        <p style={{ fontSize: 13, opacity: 0.85 }}>Free for Class 6–8</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "2px 0 6px" }}>Hi {first}, ready for today?</h1>
        <p style={{ fontSize: 14, opacity: 0.9 }}>
          {streak > 0 ? `🔥 ${streak}-day streak — keep it going!` : "Play today's puzzles to start your streak."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
        {cards.map(c => {
          const body = (
            <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", borderTop: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 30 }}>{c.icon}</div>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: "6px 0 2px" }}>{c.title}</h2>
              <p style={{ fontSize: 13.5, color: "var(--text2)", flex: 1 }}>{c.desc}</p>
              <span className="btn btn-sm" style={{ background: c.color, color: "#fff", marginTop: 12, alignSelf: "flex-start" }}>{c.cta}</span>
            </div>
          );
          return c.href
            ? <a key={c.title} href={c.href} target="_blank" rel="noreferrer">{body}</a>
            : <Link key={c.title} to={c.to}>{body}</Link>;
        })}
      </div>

      <div className="card" style={{ background: "var(--amber-light)", borderColor: "var(--amber-light)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--amber)" }}>🎯 Dreaming of becoming a doctor?</h2>
        <p style={{ fontSize: 13.5, color: "var(--text2)", marginTop: 4 }}>
          From Class 9, <strong>NEET Foundation</strong> adds mock tests, practice questions, PYQs and WhatsApp doubt support —
          30 days free, then ₹299/month. When you move to Class 9, update your class in your <Link to="/profile">profile</Link> to start.
        </p>
      </div>
    </div>
  );
}
