import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [trial, setTrial] = useState(null);
  const [tier, setTier] = useState(null); // { key, label, free }
  const [months, setMonths] = useState(12);
  const [startingTrial, setStartingTrial] = useState(false);
  const [payingPlan, setPayingPlan] = useState(null);
  const [error, setError] = useState(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/subscription/plans").then((r) => { setPlans(r.data.plans); setTrial(r.data.trial || null); setTier(r.data.tier || null); }).catch(() => {});
  }, []);

  const startTrial = async () => {
    setError(null);
    setStartingTrial(true);
    try {
      await api.post("/subscription/start-trial");
      try { window.gtag?.("event", "start_trial", { value: 0, currency: "INR" }); } catch { /* ignore */ }
      await refreshUser();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Could not start the free trial.");
      setStartingTrial(false);
    }
  };

  // Same rule as the server: this month + (N-1) more, each to its last day;
  // if a plan is still active, the new months start the day after it ends.
  const sub = user?.subscription;
  const activeEnd = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date() ? new Date(sub.endDate) : null;
  const validTill = (() => {
    const from = activeEnd ? new Date(activeEnd.getTime() + 1) : new Date();
    return new Date(from.getFullYear(), from.getMonth() + months, 0);
  })().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const monthsLabel = `${months} month${months > 1 ? "s" : ""}`;

  const pay = async (planKey) => {
    setError(null);
    setPayingPlan(planKey);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load Razorpay checkout");

      const { data: order } = await api.post("/subscription/checkout", { plan: planKey, months });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "YNeet",
        description: `Full Access · ${monthsLabel}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone || "" },
        theme: { color: "#1e3a8a" },
        handler: async (response) => {
          try {
            await api.post("/subscription/verify", response);
            // Google Analytics / Ads conversion: a paid plan (value in rupees).
            try {
              window.gtag?.("event", "purchase", {
                transaction_id: response.razorpay_payment_id,
                value: order.amount / 100,
                currency: order.currency || "INR",
                items: [{ item_id: `${planKey}_${months}M`, item_name: `Full Access · ${monthsLabel}`, quantity: months }],
              });
            } catch { /* analytics must never block activation */ }
            await refreshUser();
            navigate("/", { replace: true });
          } catch {
            setError("Payment succeeded but activation failed. Contact support with your payment ID.");
          }
        },
        modal: { ondismiss: () => setPayingPlan(null) },
      });
      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setPayingPlan(null);
      });
      rzp.open();
    } catch (e) {
      setError(e.message || "Something went wrong starting checkout.");
      setPayingPlan(null);
    }
  };

  // What each paid tier really includes today (keep in sync with www.yneet.in/courses).
  const FEATURES = tier?.key === "foundation"
    ? [
        "Shorts — 3–5 min concept videos",
        "Daily quiz and mistake notebook",
        "Daily puzzles from the Class 9–10 syllabus",
        "Doubt support on WhatsApp",
        "Foundation mock tests — coming soon",
      ]
    : [
        "Full NEET mock tests with rank analysis",
        "Shorts — 3–5 min concept videos",
        "Daily quiz, practice questions and PYQs",
        "Daily NEET puzzle games",
        "Doubt support on WhatsApp",
        "Mistake notebook, flashcards and formula sheets",
      ];
  const fallbackPlan = { key: "MONTHLY", label: "Monthly Full Access", amountRupees: 399, maxMonths: 12, prices: [] };
  const plan = plans[0] || fallbackPlan;
  const priceOf = (n) => plan.prices?.find((r) => r.months === n) || { months: n, price: plan.amountRupees * n, saving: 0 };
  const selected = priceOf(months);
  const yearPrice = priceOf(12).price;
  const OPTIONS = [
    { months: 12, title: "Full year", note: "Best value" },
    { months: 6, title: "6 months" },
    { months: 1, title: "1 month" },
  ];
  const isOption = OPTIONS.some((o) => o.months === months);
  const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  const blueBtn = { width: "100%", justifyContent: "center", textAlign: "center", background: "var(--blue-mid)", color: "#fff", padding: "12px 0", borderRadius: "var(--r)", fontWeight: 700, border: "none", cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
          {tier?.free ? "YNeet is free for you" : "Choose your plan"}
        </h1>
        <p style={{ color: "var(--text2)", marginBottom: 28 }}>
          {tier?.free
            ? "Daily quiz, Shorts and daily puzzles — free for Class 6–8."
            : `${tier?.label || "NEET Full"} · priced for your class · one-time payment, no auto-charge`}
        </p>

        {error && (
          <div style={{ background: "var(--red-light)", color: "var(--red)", padding: "10px 16px", borderRadius: "var(--r)", marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {tier?.free ? (
          <div className="card" style={{ padding: 28, maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
            <p style={{ fontSize: 26, fontWeight: 800 }}>₹0</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 20px", fontSize: 14, color: "var(--text2)", lineHeight: 2 }}>
              <li>✓ Daily puzzles from your syllabus</li>
              <li>✓ Daily quiz</li>
              <li>✓ Shorts — learn a concept in minutes</li>
            </ul>
            <button className="btn" style={blueBtn} onClick={() => navigate("/", { replace: true })}>Go to YNeet</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>
            {(!trial || trial.eligible) && (
              <div className="card" style={{ padding: 24, textAlign: "left", border: "2px solid var(--green)" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.4 }}>Start free</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>₹0</p>
                <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>{trial?.days || 30} days full access · no payment needed</p>
                <button className="btn" style={{ ...blueBtn, background: "var(--green)" }} disabled={startingTrial} onClick={startTrial}>
                  {startingTrial ? "Starting..." : `Start ${trial?.days || 30}-day free trial`}
                </button>
              </div>
            )}

            <div className="card" style={{ padding: 24, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>Buy a plan</p>
              {OPTIONS.map((o) => {
                const pr = priceOf(o.months);
                const on = months === o.months;
                return (
                  <button type="button" key={o.months} onClick={() => setMonths(o.months)}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", marginBottom: 8, borderRadius: 12, cursor: "pointer", background: on ? "var(--blue-light)" : "#fff", border: on ? "2px solid var(--blue-mid)" : "1.5px solid var(--gray3)" }}>
                    <span>
                      <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
                        {o.title} {o.note && <span className="chip chip-green" style={{ marginLeft: 4, fontSize: 11 }}>{o.note}</span>}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--text3)" }}>
                        {o.months > 1 ? `${inr(Math.round(pr.price / o.months))}/month` : "Pay as you go"}
                        {pr.saving > 0 && <span style={{ color: "var(--green)", fontWeight: 700 }}> · save {inr(pr.saving)}</span>}
                      </span>
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", whiteSpace: "nowrap" }}>{inr(pr.price)}</span>
                  </button>
                );
              })}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "4px 0 12px", fontSize: 13, color: "var(--text2)" }}>
                <span>Other length</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" aria-label="Fewer months" onClick={() => setMonths((m) => Math.max(1, m - 1))}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--gray3)", background: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>−</button>
                  <span style={{ minWidth: 76, textAlign: "center", fontWeight: 700, color: isOption ? "var(--text3)" : "var(--text)" }}>{monthsLabel}</span>
                  <button type="button" aria-label="More months" onClick={() => setMonths((m) => Math.min(plan.maxMonths || 12, m + 1))}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--gray3)", background: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>+</button>
                </span>
              </div>
              {months < 12 && selected.price >= yearPrice && (
                <p style={{ fontSize: 12.5, color: "var(--amber)", marginBottom: 10 }}>
                  A full year costs the same. <button type="button" onClick={() => setMonths(12)} style={{ border: "none", background: "none", color: "var(--blue-mid)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Switch to 12 months</button>
                </p>
              )}

              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
                Valid till <strong>{validTill}</strong>{activeEnd ? " (added after your current plan)" : ""}
              </p>
              <button className="btn" style={blueBtn} disabled={payingPlan === plan.key} onClick={() => pay(plan.key)}>
                {payingPlan === plan.key ? "Opening checkout..." : `Pay ${inr(selected.price)} for ${monthsLabel}`}
              </button>
            </div>
          </div>
        )}

        {!tier?.free && (
          <div className="card" style={{ marginTop: 20, textAlign: "left", padding: 22 }}>
            <p style={{ fontWeight: 800, marginBottom: 6 }}>Every plan and the free trial include</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 2, columns: "2 260px" }}>
              {FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <p style={{ marginTop: 12, fontSize: 13, background: "var(--amber-light)", color: "var(--amber)", padding: "8px 12px", borderRadius: 8 }}>
              A full year of YNeet costs less than {inr(Math.ceil(yearPrice / 365))} a day.
            </p>
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 12, color: "var(--text3)" }}>
          Each month runs to the end of a calendar month — e.g. 3 months bought on Aug 20 cover you through Oct 31. Buying while a plan is active adds the months after it ends.
          Secure payments via Razorpay.
        </p>
      </div>
    </div>
  );
}
