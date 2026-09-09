import { useEffect, useState } from "react";
import api from "../../lib/api";

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(""); // "" | active | inactive

  useEffect(() => {
    api.get("/admin/users").then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    if (filter === "active" && !u.subscription?.isActive) return false;
    if (filter === "inactive" && u.subscription?.isActive) return false;
    if (search && !`${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Enrolled Users ({filtered.length})</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="form-input" style={{ width: 220 }} placeholder="Search name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 140 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active sub only</option>
            <option value="inactive">No active sub</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Class</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th>Score (cur/target)</th>
              <th>Mocks</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No users found.</td></tr>}
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}{u.role === "admin" && <span className="chip chip-purple" style={{ marginLeft: 6 }}>admin</span>}</td>
                <td>{u.email}<br /><span style={{ color: "var(--text3)", fontSize: 12 }}>{u.phone || "—"}</span></td>
                <td>{u.class === "Dropper" ? "Dropper" : u.class ? `Class ${u.class.replace("th", "")}` : "—"}</td>
                <td>{u.subscription?.plan === "TRIAL_5D" ? "5-Day Trial" : u.subscription?.plan === "MONTHLY" ? "Monthly" : "—"}</td>
                <td>
                  {u.subscription?.isActive
                    ? <span className="chip chip-green">Active</span>
                    : <span className="chip" style={{ background: "var(--gray2)", color: "var(--text3)" }}>Inactive</span>}
                </td>
                <td>{fmt(u.subscription?.startDate)}</td>
                <td>{fmt(u.subscription?.endDate)}</td>
                <td>{u.currentScore ?? "—"} / {u.targetScore ?? "—"}</td>
                <td>{u.mockAttempts}</td>
                <td>{fmt(u.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
