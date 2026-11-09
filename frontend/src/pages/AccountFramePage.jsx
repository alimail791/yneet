import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Shows a www.yneet.in page inside app.yneet.in, full screen, with the app's own
// top bar. Used by the Android app (Trusted Web Activity), which is only trusted
// for app.yneet.in: opening www.yneet.in directly would bring back a browser
// address bar.
//
//   /account?page=login|register|forgot-password|logout   (Raise Academy account)
//   /explore/open?p=/neet-sprint&t=60-Second%20Sprint       (free study pages)
//
// The framed page (app mode, prices hidden) talks back with postMessage:
//   yneet-auth {token}  -> logged in / signed up: open /bridge here
//   yneet-logged-out    -> back to the Explore screen
//   yneet-explore       -> a page that isn't in the app: back to Explore
const RAISE = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "");
const RAISE_ORIGIN = (() => {
  try { return new URL(RAISE).origin; } catch { return "https://www.yneet.in"; }
})();
const ACCOUNT_PAGES = ["login", "register", "forgot-password", "logout"];
const TITLES = { login: "Log in", register: "Create free account", "forgot-password": "Reset password", logout: "Logging out" };

function useRaiseMessages() {
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== RAISE_ORIGIN || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "yneet-auth" && typeof e.data.token === "string" && e.data.token) {
        // replace(): the login screen leaves the history, so Back can't return to it.
        window.location.replace(`/bridge?token=${encodeURIComponent(e.data.token)}&app=1`);
      } else if (e.data.type === "yneet-logged-out" || e.data.type === "yneet-explore") {
        window.location.replace("/explore");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}

const BAR = 56;

function FrameShell({ src, title, showJoin }) {
  useRaiseMessages();
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ height: BAR, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        background: "var(--blue, #4f46e5)", color: "#fff" }}>
        <Link to="/explore" aria-label="Back to Explore"
          style={{ color: "#fff", fontSize: 22, lineHeight: 1, padding: "6px 8px", textDecoration: "none" }}>←</Link>
        <span style={{ fontWeight: 800, fontSize: 16, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {showJoin && (
          <Link to="/account?page=register"
            style={{ background: "#f5a623", color: "#1e1b4b", fontWeight: 800, fontSize: 13, padding: "7px 12px",
              borderRadius: 999, textDecoration: "none", whiteSpace: "nowrap" }}>Join free</Link>
        )}
      </div>
      {/* allow=identity-credentials-get: lets "Continue with Google" (FedCM) work inside this frame. */}
      <iframe key={src} title={title} src={src} allow="identity-credentials-get" style={{ flex: 1, width: "100%", border: 0 }} />
    </div>
  );
}

export default function AccountFramePage() {
  const [params] = useSearchParams();
  const page = ACCOUNT_PAGES.includes(params.get("page")) ? params.get("page") : "login";
  const src = useMemo(() => `${RAISE}/${page}?app=1&framed=1`, [page]);
  return <FrameShell src={src} title={TITLES[page]} showJoin={false} />;
}

// /explore/open?p=/neet-sprint&t=Title — a free study page from the website.
export function ExploreOpenPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const raw = params.get("p") || "/neet-sprint";
  // Only paths on www.yneet.in (no other sites, no protocol tricks).
  const path = /^\/[a-z0-9\-/]*$/i.test(raw) ? raw : "/neet-sprint";
  const title = (params.get("t") || "YNeet").slice(0, 60);
  const src = useMemo(() => `${RAISE}${path}?app=1&framed=1`, [path]);
  return <FrameShell src={src} title={title} showJoin={!user} />;
}
