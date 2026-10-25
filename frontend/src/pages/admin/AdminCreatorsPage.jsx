import { useEffect, useState } from "react";
import api from "../../lib/api";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const STATUS_CHIP = { pending: "chip-amber", approved: "chip-green", suspended: "chip-red", paid: "chip-green" };
const wa = (phone, text) => `https://wa.me/91${String(phone || "").replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;

// Creators (approve, set rate, reset password) and their weekly payouts.
export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutFilter, setPayoutFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const loadCreators = () => api.get("/admin/creators").then(r => setCreators(r.data.creators));
  const loadPayouts = () => api.get("/admin/payouts", { params: { status: payoutFilter || undefined } }).then(r => setPayouts(r.data.payouts));
  useEffect(() => { Promise.all([loadCreators(), loadPayouts()]).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadPayouts(); }, [payoutFilter]);

  const update = async (c, data) => {
    try { await api.put(`/admin/creators/${c.id}`, data); loadCreators(); }
    catch (err) { alert(err?.response?.data?.message || "Update failed"); }
  };
  const approve = async (c) => {
    await update(c, { status: "approved" });
    window.open(wa(c.phone, `Hi ${c.name.split(" ")[0]}, you're approved as a YNeet creator! 🎉 Log in at ${window.location.origin}/creator/login to submit your Shorts. You'll get ${inr(c.ratePerVideo)} for every approved Short, paid weekly.`), "_blank", "noopener");
  };
  const setRate = (c) => {
    const v = window.prompt(`Rupees per approved Short for ${c.name}:`, String(c.ratePerVideo));
    if (v !== null) update(c, { ratePerVideo: Number(v) });
  };
  const resetPassword = async (c) => {
    if (!window.confirm(`Reset ${c.name}'s password?`)) return;
    const { data } = await api.post(`/admin/creators/${c.id}/reset-password`);
    const msg = `Your YNeet creator password was reset. Log in at ${window.location.origin}/creator/login with ${data.email} and this temporary password: ${data.tempPassword} — then change it in your Profile.`;
    if (window.confirm(`Temporary password: ${data.tempPassword}\n\nSend it to ${c.name} on WhatsApp now?`)) window.open(wa(c.phone, msg), "_blank", "noopener");
  };

  const generate = async (upToNow) => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/payouts/generate", { upToNow });
      alert(data.created ? `${data.created} payout(s) created.` : "Nothing new to pay.");
      loadPayouts(); loadCreators();
    } catch (err) { alert(err?.response?.data?.message || "Failed"); }
    setBusy(false);
  };
  const markPaid = async (p) => {
    const ref = window.prompt(`Mark ${inr(p.amount + p.bonus)} to ${p.creator.name} as paid.\nUPI / bank reference (optional):`, "");
    if (ref === null) return;
    await api.put(`/admin/payouts/${p.id}`, { status: "paid", reference: ref });
    loadPayouts(); loadCreators();
  };
  const setBonus = async (p) => {
    const v = window.prompt(`Bonus for ${p.creator.name} (rupees, e.g. for a top-performing Short):`, String(p.bonus || 0));
    if (v === null) return;
    try { await api.put(`/admin/payouts/${p.id}`, { bonus: Number(v) }); loadPayouts(); } catch (err) { alert(err?.response?.data?.message || "Failed"); }
  };

  const pendingApps = creators.filter(c => c.status === "pending").length;
  const owed = payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount + p.bonus, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Creators ({creators.length})</h1>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            Teachers apply at <a href="/creator/apply" target="_blank" rel="noreferrer" style={{ color: "var(--blue-mid)" }}>{window.location.origin}/creator/apply</a>
            {pendingApps > 0 && <> · <strong style={{ color: "var(--amber)" }}>{pendingApps} waiting for approval</strong></>}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 24 }}>
        <table className="admin-table">
          <thead><tr><th>Creator</th><th>Teaches</th><th>Status</th><th>Rate</th><th>Shorts</th><th>Viewers</th><th>Owed</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>}
            {!loading && creators.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No creators yet. Share the apply link with teachers.</td></tr>}
            {creators.map(c => (
              <tr key={c.id}>
                <td style={{ maxWidth: 220 }}>
                  <button onClick={() => setOpen(open === c.id ? null : c.id)} style={{ border: "none", background: "none", padding: 0, fontWeight: 700, cursor: "pointer", color: "var(--text)", textAlign: "left" }}>{c.name} {open === c.id ? "▴" : "▾"}</button>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{c.email} · {c.phone}</div>
                  {open === c.id && (
                    <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6, lineHeight: 1.6 }}>
                      {c.bio && <div>{c.bio}</div>}
                      {c.youtubeUrl && <div><a href={c.youtubeUrl} target="_blank" rel="noreferrer" style={{ color: "var(--red)" }}>YouTube ↗</a></div>}
                      {c.instagramUrl && <div><a href={c.instagramUrl} target="_blank" rel="noreferrer" style={{ color: "var(--purple)" }}>Instagram ↗</a></div>}
                      <div>UPI: {c.upiId || "not added"}</div>
                      <div>Applied {fmt(c.createdAt)}</div>
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12.5 }}>{c.subjects.join(", ") || "—"}<div style={{ color: "var(--text3)" }}>{c.languages.join(", ")}</div></td>
                <td><span className={`chip ${STATUS_CHIP[c.status]}`}>{c.status}</span></td>
                <td><button className="btn btn-outline btn-sm" onClick={() => setRate(c)}>{inr(c.ratePerVideo)}</button></td>
                <td style={{ fontSize: 12.5 }}>{c.shorts.approved} live{c.shorts.pending ? <div style={{ color: "var(--amber)" }}>{c.shorts.pending} to review</div> : null}</td>
                <td>{c.viewers}</td>
                <td>{inr(c.unpaidAmount)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {c.status !== "approved" && <button className="btn btn-green btn-sm" onClick={() => approve(c)}>Approve</button>}{" "}
                  {c.status === "approved" && <button className="btn btn-sm" style={{ background: "var(--red-light)", color: "var(--red)" }} onClick={() => window.confirm(`Suspend ${c.name}? They won't be able to log in.`) && update(c, { status: "suspended" })}>Suspend</button>}{" "}
                  <button className="btn btn-outline btn-sm" onClick={() => resetPassword(c)}>Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Weekly payouts</h2>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Created automatically every Monday for Shorts approved the week before.{owed > 0 && <> · <strong>{inr(owed)}</strong> to pay</>}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="form-select" style={{ width: 130 }} value={payoutFilter} onChange={e => setPayoutFilter(e.target.value)}>
            <option value="pending">To pay</option><option value="paid">Paid</option><option value="">All</option>
          </select>
          <button className="btn btn-outline" disabled={busy} onClick={() => generate(false)} title="Bundle Shorts approved up to last Sunday">Create last week's</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => generate(true)} title="Also include Shorts approved this week">Include this week</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Creator</th><th>Period</th><th>Shorts</th><th>Amount</th><th>Bonus</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {payouts.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No payouts here.</td></tr>}
            {payouts.map(p => (
              <tr key={p.id}>
                <td><strong>{p.creator.name}</strong><div style={{ fontSize: 12, color: "var(--text3)" }}>UPI: {p.creator.upiId || "not added"}</div></td>
                <td style={{ fontSize: 12.5 }}>{fmt(p.periodStart)} – {fmt(new Date(new Date(p.periodEnd).getTime() - 1))}</td>
                <td>{p.videoCount}</td>
                <td>{inr(p.amount)}</td>
                <td>{p.status === "pending" ? <button className="btn btn-outline btn-sm" onClick={() => setBonus(p)}>{p.bonus ? inr(p.bonus) : "+ Bonus"}</button> : (p.bonus ? inr(p.bonus) : "—")}</td>
                <td style={{ fontWeight: 800 }}>{inr(p.amount + p.bonus)}</td>
                <td><span className={`chip ${STATUS_CHIP[p.status] || "chip-amber"}`}>{p.status === "paid" ? `Paid ${fmt(p.paidAt)}` : "To pay"}</span>{p.reference && <div style={{ fontSize: 11.5, color: "var(--text3)" }}>{p.reference}</div>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {p.status === "pending" && <button className="btn btn-green btn-sm" onClick={() => markPaid(p)}>Mark paid</button>}{" "}
                  {p.status === "paid" && <a className="btn btn-outline btn-sm" href={wa(p.creator.phone, `Hi ${p.creator.name.split(" ")[0]}, your YNeet payout of ${inr(p.amount + p.bonus)} for ${p.videoCount} Short${p.videoCount === 1 ? "" : "s"} has been sent${p.reference ? ` (ref ${p.reference})` : ""}. Thank you! 🙏`)} target="_blank" rel="noreferrer">Notify</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
