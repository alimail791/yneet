import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// /account?page=login|register|forgot-password|logout
//
// The Android app (Trusted Web Activity) is only trusted for app.yneet.in, so
// any page on www.yneet.in shows a browser address bar. Login, sign-up and
// logout live on www.yneet.in (the shared Raise Academy account), so inside the
// app we show those pages in a full-screen frame here instead. When the student
// logs in or signs up, the framed page posts the Raise token to us and we open
// /bridge ourselves, staying on app.yneet.in (full screen) the whole time.
const RAISE = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "");
const RAISE_ORIGIN = (() => {
  try { return new URL(RAISE).origin; } catch { return "https://www.yneet.in"; }
})();
const PAGES = ["login", "register", "forgot-password", "logout"];

export default function AccountFramePage() {
  const [params] = useSearchParams();
  const page = PAGES.includes(params.get("page")) ? params.get("page") : "login";
  const src = useMemo(() => `${RAISE}/${page}?app=1&framed=1`, [page]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== RAISE_ORIGIN || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "yneet-auth" && typeof e.data.token === "string" && e.data.token) {
        // replace(): the login screen leaves the history, so Back can't return to it.
        window.location.replace(`/bridge?token=${encodeURIComponent(e.data.token)}&app=1`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      title="YNeet account"
      src={src}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#fff" }}
    />
  );
}
