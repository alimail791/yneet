import { useEffect, useState } from "react";
import api from "../lib/api";

export default function ReferralPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/user/referral").then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(data.registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!data) return null;

  return (
    <div>
      <div className="section-header mb-4">
        <div>
          <div className="section-title" style={{ fontSize: 22 }}>🎁 Refer &amp; Earn</div>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Get one friend to enroll in the Monthly plan — you get a free month.</p>
        </div>
      </div>

      <div className="card" style={{ background: "linear-gradient(135deg,var(--blue-mid),var(--purple))", color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Your Referral Link</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ background: "rgba(255,255,255,.15)", padding: "8px 12px", borderRadius: 8, fontSize: 13, wordBreak: "break-all", flex: 1, minWidth: 200 }}>
            {data.registerUrl}
          </code>
          <button className="btn" style={{ background: "#fff", color: "var(--blue-mid)", fontWeight: 700 }} onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.85, marginTop: 10 }}>Your code: <strong>{data.referralCode}</strong></p>
      </div>

      <div className="grid3 mb-5">
        <div className="card">
          <div className="card-title">Friends Referred</div>
          <div className="card-value" style={{ color: "var(--blue)" }}>{data.referrals.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Qualified (paid Monthly)</div>
          <div className="card-value" style={{ color: "var(--green)" }}>{data.qualifiedCount}</div>
        </div>
        <div className="card">
          <div className="card-title">Free Months Earned</div>
          <div className="card-value" style={{ color: "var(--amber)" }}>{data.freeMonthsEarned}</div>
        </div>
      </div>

      <div className="section-title mb-2" style={{ fontSize: 15 }}>Your Referrals</div>
      {data.referrals.length === 0 ? (
        <div className="card text-center" style={{ padding: 30 }}>
          <p style={{ color: "var(--text3)" }}>No referrals yet — share your link above to get started!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.referrals.map((r, i) => (
            <div key={i} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>Joined {new Date(r.joinedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
              {r.rewardGranted ? (
                <span className="chip chip-green">Reward Given — Free Month</span>
              ) : r.qualified ? (
                <span className="chip chip-blue">Qualified</span>
              ) : (
                <span className="chip" style={{ background: "var(--gray2)", color: "var(--text3)" }}>Pending Monthly plan</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
