import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expiryNotice, setExpiryNotice] = useState(null); // null | { hoursLeft, endDate }
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const streak = user?.streak?.current || 0;

  // Show a one-time-per-login popup if the subscription is in its final day.
  // sessionStorage means it won't nag on every page navigation within the same
  // login, but it WILL show again next time they log in (new browser session).
  useEffect(() => {
    const sub = user?.subscription;
    if (!sub?.endDate || sub.status !== "active") return;
    const end = new Date(sub.endDate);
    const hoursLeft = (end - new Date()) / (1000 * 60 * 60);
    if (hoursLeft > 0 && hoursLeft <= 24 && !sessionStorage.getItem("yneet_expiry_notice_shown")) {
      setExpiryNotice({ hoursLeft, endDate: end });
      sessionStorage.setItem("yneet_expiry_notice_shown", "1");
    }
  }, [user?.subscription?.endDate, user?.subscription?.status]);

  const tabs = [
    { to: "/",         label: "Dashboard", end: true },
    { to: "/mock",     label: "Mock Tests" },
    { to: "/quiz",     label: "Daily Quiz" },
    { to: "/practice", label: "Practice" },
    { to: "/biology",  label: "Biology" },
    { to: "/physics",  label: "Physics" },
    { to: "/chemistry",label: "Chemistry" },
    { to: "/mistakes", label: "Mistakes" },
  ];

  const mobileTabs = [
    { to: "/",         label: "Home",      icon: "🏠", end: true },
    { to: "/mock",     label: "Tests",     icon: "📝" },
    { to: "/quiz",     label: "Quiz",      icon: "⚡" },
    { to: "/practice", label: "Practice",  icon: "📖" },
  ];

  // Everything that doesn't fit in the 5-slot bottom bar lives behind "More".
  const moreLinks = [
    { to: "/biology",   label: "Biology Flashcards", icon: "🧬" },
    { to: "/physics",   label: "Physics Formulas",   icon: "⚛️" },
    { to: "/chemistry", label: "Chemistry Hub",      icon: "🧪" },
    { to: "/mistakes",  label: "Mistake Notebook",   icon: "❌" },
    { to: "/profile",   label: "Profile",            icon: "👤" },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin Panel", icon: "⚙️" }] : []),
  ];

  return (
    <>
      <nav className="app-nav">
        <div className="nav-logo">YNeet 🎯</div>
        <div className="nav-tabs">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {({ isActive }) => (
                <button className={`nav-tab${isActive ? " active" : ""}`}>{t.label}</button>
              )}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          {streak > 0 && <span className="streak-badge">🔥 {streak}</span>}
          {user?.role === "admin" && (
            <button className="btn btn-outline btn-sm" onClick={() => navigate("/admin")}>⚙️ Admin</button>
          )}
          <button className="avatar" onClick={() => navigate("/profile")} title="Profile">{initials}</button>
          <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-content">
        <Outlet />
      </div>

      {expiryNotice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 28, maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Your plan ends today!</h2>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 20 }}>
              Your subscription expires at {expiryNotice.endDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} today ({expiryNotice.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}).
              Renew now to keep access to mock tests, quizzes, flashcards and formulas without interruption.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-outline" onClick={() => setExpiryNotice(null)}>Later</button>
              <button className="btn btn-blue" onClick={() => { setExpiryNotice(null); navigate("/pricing"); }}>Renew Now</button>
            </div>
          </div>
        </div>
      )}

      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: "10px 8px calc(env(safe-area-inset-bottom, 0px) + 10px)", boxShadow: "0 -8px 24px rgba(0,0,0,.12)" }}
          >
            <div style={{ width: 36, height: 4, background: "var(--gray3)", borderRadius: 2, margin: "6px auto 14px" }} />
            {moreLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMoreOpen(false)}
                style={{ textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  <span style={{ fontSize: 20 }}>{l.icon}</span>
                  {l.label}
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        {mobileTabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            {({ isActive }) => (
              <button className={`mob-tab${isActive ? " active" : ""}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            )}
          </NavLink>
        ))}
        <button className="mob-tab" onClick={() => setMoreOpen(true)}>
          <span>☰</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
