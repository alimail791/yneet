import { useEffect, useState } from "react";
import api from "../../lib/api";

// Are students taking tests, coming back and inviting friends? Backend: utils/growth.js.
const Tile = ({ label, value, sub, color = "blue" }) => (
  <div className="card">
    <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 800, color: `var(--${color})`, marginTop: 6 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{sub}</div>}
  </div>
);

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 24 };
const h2 = { fontSize: 16, fontWeight: 800, margin: "4px 0 10px" };
const th = { textAlign: "right", padding: "8px 10px", fontSize: 12, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid var(--border)" };
const td = { textAlign: "right", padding: "8px 10px", fontSize: 14, borderBottom: "1px solid var(--border)" };
const pctTxt = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const weekLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function Step({ label, value, of }) {
  const w = of ? Math.max(4, Math.round((value / of) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{label}</span><strong>{value}</strong></div>
      <div style={{ height: 8, background: "var(--gray2)", borderRadius: 6, marginTop: 4 }}>
        <div style={{ width: `${of ? w : 0}%`, height: 8, background: "var(--blue-mid)", borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function AdminGrowthPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/admin/growth").then((r) => setD(r.data)).catch((e) => setErr(e?.response?.data?.message || "Couldn't load growth numbers.")); }, []);

  if (err) return <div className="card">{err}</div>;
  if (!d) return <div className="card">Loading…</div>;
  const { activation: a, last7, weekly, funnel: f, allIndia, plans: p } = d;
  const top = Math.max(f.challengeShares + f.inviteShares, f.challengeOpens, f.friendsJoined, 1);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Growth</h1>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>Are new students taking tests, coming back and bringing friends? Check this every Monday.</p>

      <div style={h2}>New students</div>
      <div style={grid}>
        <Tile label="Sign-ups (30 days)" value={a.newStudents30} />
        <Tile label="First test in 24 h" value={pctTxt(a.firstTest24hPct)} sub={`${a.firstTest24h} of ${a.cohort24} new students`} color="green" />
        <Tile label="Took any test" value={pctTxt(a.anyTest30Pct)} sub="of sign-ups in the last 30 days" color="green" />
        <Tile label="Came back in 7 days" value={pctTxt(a.back7Pct)} sub={`${a.back7} of ${a.cohort7} (tested again on day 2–7)`} color="purple" />
      </div>

      <div style={h2}>Last 7 days</div>
      <div style={grid}>
        <Tile label="Tests submitted" value={last7.tests} />
        <Tile label="Students testing" value={last7.students} color="green" />
        <Tile label="Tests per student" value={last7.testsPerStudent} color="amber" />
        <Tile label="Free-tier students testing" value={p.freeTierActive7} sub={`of ${p.freeTier} on the free tier`} color="purple" />
      </div>

      <div style={h2}>Week by week</div>
      <div className="card" style={{ overflowX: "auto", marginBottom: 24, padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Week of</th><th style={th}>Sign-ups</th><th style={th}>Tests</th><th style={th}>Students testing</th><th style={th}>Friends joined</th></tr></thead>
          <tbody>{weekly.map((w) => (
            <tr key={w.week}><td style={{ ...td, textAlign: "left" }}>{weekLabel(w.week)}</td><td style={td}>{w.signups}</td><td style={td}>{w.tests}</td><td style={td}>{w.activeStudents}</td><td style={td}>{w.friendsJoined}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div className="card">
          <div style={h2}>Invites & challenges (30 days)</div>
          <Step label="Invite links shared" value={f.inviteShares} of={top} />
          <Step label="Challenges shared" value={f.challengeShares} of={top} />
          <Step label="Challenge links opened" value={f.challengeOpens} of={top} />
          <Step label="Challenges accepted" value={f.challengeStarts} of={top} />
          <Step label="Friends joined with a link" value={f.friendsJoined} of={top} />
          <Step label="Friends confirmed (reward given)" value={f.friendsConfirmed} of={top} />
          <p style={{ fontSize: 12, color: "var(--text3)" }}>{f.referrers} student(s) brought at least one friend. Shares are counted from the in-app buttons (since 23 Nov 2026).</p>
        </div>
        <div className="card">
          <div style={h2}>All-India Mock</div>
          {allIndia.length === 0 ? <p style={{ fontSize: 13, color: "var(--text3)" }}>No All-India mock yet — the first is on Sunday.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Sunday</th><th style={th}>Ranked</th><th style={th}>All attempts</th></tr></thead>
              <tbody>{allIndia.map((r) => (
                <tr key={r.date}><td style={{ ...td, textAlign: "left" }}>{weekLabel(r.date)}</td><td style={td}>{r.ranked}</td><td style={td}>{r.attempts}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <div style={h2}>Plans right now</div>
      <div style={grid}>
        <Tile label="Paid" value={p.paid} color="green" />
        <Tile label="Free trial" value={p.trial} />
        <Tile label="Institute seats" value={p.institute} color="purple" />
        <Tile label="Referral free days" value={p.referralFree} color="amber" />
        <Tile label="Free tier (9+)" value={p.freeTier} sub="trial over, 1 test/day" />
        <Tile label="Class 6–8 free" value={p.juniorFree} />
      </div>
    </div>
  );
}
