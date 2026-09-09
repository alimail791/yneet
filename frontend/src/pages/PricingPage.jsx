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
  const [payingPlan, setPayingPlan] = useState(null);
  const [error, setError] = useState(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/subscription/plans").then((r) => setPlans(r.data.plans)).catch(() => {});
  }, []);

  const pay = async (planKey) => {
    setError(null);
    setPayingPlan(planKey);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load Razorpay checkout");

      const { data: order } = await api.post("/subscription/checkout", { plan: planKey });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "YNeet",
        description: planKey === "TRIAL_5D" ? "5-Day Full Access" : "Monthly Full Access",
        prefill: { name: user?.name, email: user?.email, contact: user?.phone || "" },
        theme: { color: "#1e3a8a" },
        handler: async (response) => {
          try {
            await api.post("/subscription/verify", response);
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {(plans.length ? plans : [
            { key: "TRIAL_5D", label: "5-Day Full Access", amountRupees: 99, duration: "5 days" },
            { key: "MONTHLY", label: "Monthly Full Access", amountRupees: 299, duration: "Till end of current calendar month" },
          ]).map((p) => (
            <div key={p.key} className="card" style={{ padding: 28, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-mid)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {p.key === "TRIAL_5D" ? "Quick Start" : "Best Value"}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>
                ₹{p.amountRupees}
              </p>
              <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 18 }}>{p.duration}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: 14, color: "var(--text2)", lineHeight: 2 }}>
                <li>✓ Mock tests</li>
                <li>✓ Daily quiz</li>
                <li>✓ Practice questions bank</li>
                <li>✓ Mistake notebook</li>
                <li>✓ Flashcards</li>
                <li>✓ Physics &amp; Chemistry formula sheets</li>
              </ul>
              <button
                className="btn"
                style={{ width: "100%", background: "var(--blue-mid)", color: "#fff", padding: "12px 0", borderRadius: "var(--r)", fontWeight: 700, border: "none", cursor: "pointer" }}
                disabled={payingPlan === p.key}
                onClick={() => pay(p.key)}
              >
                {payingPlan === p.key ? "Opening checkout..." : `Get ${p.label}`}
              </button>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 28, fontSize: 12, color: "var(--text3)" }}>
          Monthly plans run to the end of the calendar month you subscribe in — e.g. enrolling Aug 20 covers you through Aug 31.
          Secure payments via Razorpay.
        </p>
      </div>
    </div>
  );
}
