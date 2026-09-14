import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const tabs = [
  { to: "/admin",            label: "Summary",   end: true },
  { to: "/admin/users",      label: "Users" },
  { to: "/admin/questions",  label: "Questions" },
  { to: "/admin/mocktests",  label: "Mock Tests" },
  { to: "/admin/flashcards", label: "Flashcards" },
  { to: "/admin/formulas",   label: "Formulas" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--gray3)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: "var(--blue-mid)" }}>YNeet Admin</span>
            <div style={{ display: "flex", gap: 4 }}>
              {tabs.map(t => (
                <NavLink key={t.to} to={t.to} end={t.end}>
                  {({ isActive }) => (
                    <span style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: isActive ? "var(--blue-mid)" : "var(--text2)", background: isActive ? "var(--blue-light)" : "transparent" }}>
                      {t.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate("/")}>← Student View</button>
            <button className="btn btn-outline btn-sm" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <Outlet />
      </div>
    </div>
  );
}
