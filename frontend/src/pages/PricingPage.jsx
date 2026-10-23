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
  const [months, setMonths] = useState(1);
  const [startingTrial, setStartingTrial] = useState(false);
  const [payingPlan, setPayingPlan] = useState(null);
  const [error, setError] = useState(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/subscription/plans").then((r) => { setPlans(r.data.plans); setTrial(r.data.trial || null); }).catch(() => {});
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--gray)", padding: "48px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
          Unlock YNeet
        </h1>
        <p style={{ color: "var(--text2)", marginBottom: 36 }}>
          Mock tests, daily quizzes, practice questions, flashcards & formula sheets — all scoped to your class syllabus.
        </p>

        {error && (
          <div style={{ background: "var(--red-light)", color: "var(--red)", padding: "10px 16px", borderRadius: "var(--r)", marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {(!trial || trial.eligible) && (
            <div className="card" style={{ padding: 28, textAlign: "left", border: "2px solid var(--blue-mid)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: 0.4 }}>Free Trial</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>₹0</p>
              <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 18 }}>{trial?.days || 30} days full access · no payment needed</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: 14, color: "var(--text2)", lineHeight: 2 }}>
                <li>✓ Every mock test &amp; daily quiz</li>
                <li>✓ Practice questions &amp; PYQs</li>
                <li>✓ Mistake notebook &amp; flashcards</li>
                <li>✓ Formula sheets</li>
                <li>✓ No card, no auto-charge</li>
              </ul>
              <button className="btn" style={{ width: "100%", justifyContent: "center", textAlign: "center", background: "var(--blue-mid)", color: "#fff", padding: "12px 0", borderRadius: "var(--r)", fontWeight: 700, border: "none", cursor: "pointer" }}
                disabled={startingTrial} onClick={startTrial}>
                {startingTrial ? "Starting..." : `Start ${trial?.days || 30}-day free trial`}
              </button>
            </div>
          )}
          {(plans.length ? plans : [{ key: "MONTHLY", label: "Monthly Full Access", amountRupees: 500, maxMonths: 12 }]).map((p) => (
            <div key={p.key} className="card" style={{ padding: 28, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: 0.4 }}>Choose your months</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>
                ₹{(p.amountRupees * months).toLocaleString("en-IN")}
              </p>
              <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 14 }}>
                ₹{p.amountRupees}/month × {monthsLabel} · priced for your class
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <button type="button" aria-label="Fewer months" onClick={() => setMonths((m) => Math.max(1, m - 1))}
                  style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border, #cbd5e1)", background: "transparent", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>−</button>
                <span style={{ minWidth: 90, textAlign: "center", fontWeight: 700, color: "var(--text)" }}>{monthsLabel}</span>
                <button type="button" aria-label="More months" onClick={() => setMonths((m) => Math.min(p.maxMonths || 12, m + 1))}
                  style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border, #cbd5e1)", background: "transparent", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[1, 3, 6, 12].map((m) => (
                  <button type="button" key={m} onClick={() => setMonths(m)}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 999, cursor: "pointer", border: months === m ? "1px solid var(--blue-mid)" : "1px solid var(--border, #cbd5e1)", background: months === m ? "var(--blue-mid)" : "transparent", color: months === m ? "#fff" : "var(--text2)" }}>
                    {m === 1 ? "1 month" : `${m} months`}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>
                Valid till <strong>{validTill}</strong>{activeEnd ? " (added after your current plan)" : ""}
              </p>
              <button
                className="btn"
                style={{ width: "100%", justifyContent: "center", textAlign: "center", background: "var(--blue-mid)", color: "#fff", padding: "12px 0", borderRadius: "var(--r)", fontWeight: 700, border: "none", cursor: "pointer" }}
                disabled={payingPlan === p.key}
                onClick={() => pay(p.key)}
              >
                {payingPlan === p.key ? "Opening checkout..." : `Pay ₹${(p.amountRupees * months).toLocaleString("en-IN")} for ${monthsLabel}`}
              </button>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 28, fontSize: 12, color: "var(--text3)" }}>
          Each month runs to the end of a calendar month — e.g. 3 months bought on Aug 20 cover you through Oct 31. Buying while a plan is active adds the months after it ends.
          Secure payments via Razorpay.
        </p>
      </div>
    </div>
  );
}
