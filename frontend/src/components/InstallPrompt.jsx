import { useEffect, useState } from "react";

// "Install YNeet" banner. Chrome/Android fire `beforeinstallprompt`; iOS Safari
// has no such event, so we show a short "Share → Add to Home Screen" hint.
// Hidden when already installed, and after dismissal for 7 days.
const KEY = "yneet_install_dismissed";
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      const t = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - t < 7 * 24 * 3600 * 1000) return;
    } catch { /* storage unavailable */ }

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) setShowIos(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  };

  if (!deferred && !showIos) return null;

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: 76, zIndex: 900, maxWidth: 420, margin: "0 auto",
      background: "#fff", border: "1.5px solid #e0e7ff", borderRadius: 14, padding: "12px 14px",
      boxShadow: "0 8px 28px rgba(79,70,229,.25)", display: "flex", alignItems: "center", gap: 12,
    }}>
      <img src="/icons/icon-192.png" alt="" width="44" height="44" style={{ borderRadius: 10 }} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Install YNeet app</div>
        {deferred
          ? <div style={{ color: "#6b7280" }}>Open it from your home screen, like a normal app.</div>
          : <div style={{ color: "#6b7280" }}>Tap <b>Share</b>, then <b>Add to Home Screen</b>.</div>}
      </div>
      {deferred && <button className="btn btn-blue btn-sm" onClick={install}>Install</button>}
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: "none", border: 0, fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>×</button>
    </div>
  );
}
