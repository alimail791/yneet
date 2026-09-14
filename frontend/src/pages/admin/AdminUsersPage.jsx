import { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toInputDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(""); // "" | active | inactive
  const [manageUser, setManageUser] = useState(null); // the row being managed, or null
  const [subForm, setSubForm] = useState({ plan: "NONE", status: "inactive", endDate: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/users").then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = users.filter(u => {
    if (filter === "active" && !u.subscription?.isActive) return false;
    if (filter === "inactive" && u.subscription?.isActive) return false;
    if (search && !`${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openManage = (u) => {
    setManageUser(u);
    setSubForm({
      plan: u.subscription?.plan || "NONE",
      status: u.subscription?.status || "inactive",
      endDate: toInputDate(u.subscription?.endDate),
    });
  };
  const closeManage = () => setManageUser(null);

  const saveSubscription = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${manageUser.id}/subscription`, subForm);
      closeManage();
      load();
    } catch (err) { alert(err?.response?.data?.message || "Update failed"); }
    setSaving(false);
  };

  const toggleRole = async (u) => {
    const newRole = u.role === "admin" ? "student" : "admin";
    if (!window.confirm(`${newRole === "admin" ? "Grant" : "Remove"} admin access for ${u.name}?`)) return;
    try {
      await api.put(`/admin/users/${u.id}/role`, { role: newRole });
      load();
    } catch (err) { alert(err?.response?.data?.message || "Update failed"); }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}'s YNeet account permanently? This removes their subscription, attempts, and progress. Their Raise Academy account is unaffected.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      load();
    } catch (err) { alert(err?.response?.data?.message || "Delete failed"); }
  };

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No users found.</td></tr>}
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}{u.role === "admin" && <span className="chip chip-purple" style={{ marginLeft: 6 }}>admin</span>}</td>
                <td>{u.email}<br /><span style={{ color: "var(--text3)", fontSize: 12 }}>{u.phone || "—"}</span></td>
                <td>{u.class === "Dropper" ? "Dropper" : u.class ? `Class ${u.class.replace("th", "")}` : "—"}</td>
                <td>{u.subscription?.plan === "TRIAL_5D" ? "5-Day Trial" : u.subscription?.plan === "MONTHLY" ? "Monthly" : u.subscription?.plan === "REFERRAL_FREE" ? "Referral Free" : "—"}</td>
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
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openManage(u)}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manageUser && (
        <div className="admin-modal-backdrop" onClick={closeManage}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{manageUser.name}</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>{manageUser.email}</p>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Subscription</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
              <div>
                <label className="form-label">Plan</label>
                <select className="form-select" value={subForm.plan} onChange={e => setSubForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="NONE">None</option>
                  <option value="TRIAL_5D">5-Day Trial</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="REFERRAL_FREE">Referral Free Month</option>
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" value={subForm.status} onChange={e => setSubForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Ends On</label>
                <input className="form-input" type="date" value={subForm.endDate} onChange={e => setSubForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 16 }}>
              Use this to comp a free month, extend a plan, or manually correct a payment issue. This doesn't touch Razorpay — it just sets what YNeet believes their plan status is.
            </p>
            <button className="btn btn-blue btn-sm" onClick={saveSubscription} disabled={saving} style={{ marginBottom: 22 }}>
              {saving ? "Saving..." : "Save Subscription"}
            </button>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, borderTop: "1px solid var(--gray3)", paddingTop: 18 }}>Role</h3>
            {manageUser.id === me?.id ? (
              <p style={{ fontSize: 13, color: "var(--text3)" }}>You can't change your own admin access from here.</p>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => toggleRole(manageUser)}>
                {manageUser.role === "admin" ? "Remove Admin Access" : "Make Admin"}
              </button>
            )}

            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "22px 0 10px", borderTop: "1px solid var(--gray3)", paddingTop: 18, color: "var(--red)" }}>Danger Zone</h3>
            {manageUser.id === me?.id ? (
              <p style={{ fontSize: 13, color: "var(--text3)" }}>You can't delete your own account from here.</p>
            ) : (
              <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => { removeUser(manageUser); closeManage(); }}>
                Delete YNeet Account
              </button>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn-outline" onClick={closeManage}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
