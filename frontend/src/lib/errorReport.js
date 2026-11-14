// Crash reporting without a third-party service: errors in students' browsers
// (and in the Android app, which loads this site) are sent to the API and
// appear in the Railway logs of the YNeet API service, tagged [client-error].
// At most 5 reports per page load, duplicates skipped.
const sent = new Set();
let count = 0;

export function reportError(kind, error, extra = {}) {
  try {
    const message = String(error?.message || error || "unknown").slice(0, 500);
    const key = `${kind}:${message}`;
    if (sent.has(key) || count >= 5) return;
    sent.add(key);
    count++;
    const body = JSON.stringify({
      kind,
      message,
      stack: String(error?.stack || "").slice(0, 2000),
      url: location.pathname + location.search,
      ua: navigator.userAgent.slice(0, 200),
      app: /android-app:\/\//.test(document.referrer) || sessionStorage.getItem("yneet_app_mode") === "1",
      ...extra,
    });
    const url = `${import.meta.env.VITE_API_URL || "/api/v1"}/public/client-error`;
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    else fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
  } catch { /* never let reporting break the page */ }
}

export function installErrorReporting() {
  window.addEventListener("error", (e) => {
    // Ignore failed image/script loads and browser-extension noise.
    if (!e.error && !e.message) return;
    if (/^Script error\.?$/.test(e.message)) return;
    reportError("error", e.error || e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    if (r?.isAxiosError || r?.response) return; // API errors are already logged by the server
    reportError("promise", r);
  });
}
