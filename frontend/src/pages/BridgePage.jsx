import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Landing target of the "YNeet" button on Raise Academy: /bridge?token=<raise_academy_jwt>
// Exchanges that token for a provisioned YNeet session, then routes the student to
// pricing (no active plan) or straight into the dashboard (already subscribed).
export default function BridgePage() {
  const [params] = useSearchParams();
  const { bridgeLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // React 18 StrictMode intentionally double-invokes effects in development.
    // Without this guard, bridgeLogin() would fire twice for the same token,
    // creating two server-side sessions in a race and leaving the client with
    // a token whose sid doesn't match the one the server kept — causing a
    // spurious "logged out" error right after a successful bridge.
    if (hasRun.current) return;
    hasRun.current = true;

    const token = params.get("token");
    if (!token) {
      setError("Missing session — please open YNeet from your Raise Academy dashboard.");
      return;
    }
    bridgeLogin(token)
      .then((user) => {
        if (user?.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }
        const active = user?.subscription?.status === "active" &&
          user?.subscription?.endDate && new Date(user.subscription.endDate) > new Date();
        navigate(active ? "/" : "/pricing", { replace: true });
      })
      .catch(() => setError("Could not verify your Raise Academy session. Please try again from the dashboard."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (error) {
    return (
      <div className="loading-screen">
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: "var(--text)", fontWeight: 700, marginBottom: 6 }}>Sign-in failed</p>
          <p style={{ color: "var(--text2)", fontSize: 14 }}>{error}</p>
          <a
            href={import.meta.env.VITE_RAISE_ACADEMY_URL || "/"}
            style={{ display: "inline-block", marginTop: 16, color: "var(--blue-mid)", fontWeight: 600 }}
          >
            ← Back to Raise Academy
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p style={{ color: "var(--text2)", fontSize: 14 }}>Signing you into YNeet...</p>
    </div>
  );
}
