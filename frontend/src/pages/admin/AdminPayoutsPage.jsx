import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api from "../../lib/api";

const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Standard UPI deep-link format — any UPI app (GPay, PhonePe, Paytm, etc.)
// recognizes this when scanned and pre-fills the payee, amount, and note.
const upiUri = (upiId, name, amount) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent("YNeet referral reward")}`;

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [qrPayout, setQrPayout] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/payouts", { params: { status: filter || undefined } })
      .then(r => setPayouts(r.data.payouts))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const markPaid = async (p) => {
    if (!window.confirm(`Confirm you've already sent ₹${p.amount} to ${p.user.name} (${p.user.upiId || "no UPI ID on file!"}) via UPI?`)) return;
    await api.put(`/admin/payouts/${p.id}/paid`);
    load();
  };

  const pendingTotal = payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Referral Cash Payouts</h1>
        <select className="form-select" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="pending">Pending only</option>
          <option value="paid">Paid only</option>
          <option value="">All</option>
        </select>
      </div>

      {filter === "pending" && payouts.length > 0 && (
        <div className="card" style={{ background: "var(--amber-light)", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>₹{pendingTotal} total pending across {payouts.length} referrer{payouts.length === 1 ? "" : "s"}</p>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 16 }}>
        These are ₹200 cash rewards earned when a referred friend buys the Monthly plan. This app doesn't move money automatically — pay each one manually via your own UPI app using the ID shown, then click "Mark Paid" to record it.
      </p>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Referrer</th><th>Email</th><th>UPI ID</th><th>Amount</th><th>Status</th><th>Requested</th><th>Paid On</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && payouts.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No payouts here.</td></tr>}
            {payouts.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.user.name}</td>
                <td>{p.user.email}</td>
                <td>
                  {p.user.upiId
                    ? (
                      <button className="btn btn-outline btn-sm" onClick={() => setQrPayout(p)}>
                        <code style={{ fontSize: 12 }}>{p.user.upiId}</code> · Show QR
                      </button>
                    )
                    : <span className="chip chip-red">Not added yet</span>}
                </td>
                <td>₹{p.amount}</td>
                <td>{p.status === "paid" ? <span className="chip chip-green">Paid</span> : <span className="chip chip-amber">Pending</span>}</td>
                <td>{fmt(p.createdAt)}</td>
                <td>{fmt(p.paidAt)}</td>
                <td>
                  {p.status === "pending" && (
                    <button className="btn btn-blue btn-sm" onClick={() => markPaid(p)} disabled={!p.user.upiId}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qrPayout && (
        <div className="admin-modal-backdrop" onClick={() => setQrPayout(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{qrPayout.user.name}</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>₹{qrPayout.amount} referral reward</p>

            <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 12, border: "1px solid var(--gray3)", marginBottom: 16 }}>
              <QRCodeSVG value={upiUri(qrPayout.user.upiId, qrPayout.user.name, qrPayout.amount)} size={220} />
            </div>

            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>Scan with any UPI app (GPay, PhonePe, Paytm...) from your phone</p>
            <code style={{ fontSize: 13, fontWeight: 600 }}>{qrPayout.user.upiId}</code>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22 }}>
              <button className="btn btn-outline" onClick={() => setQrPayout(null)}>Close</button>
              {qrPayout.status === "pending" && (
                <button className="btn btn-blue" onClick={() => { markPaid(qrPayout); setQrPayout(null); }}>Mark Paid</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
