// Turn on daily reminders (web push). Works in Chrome on Android, in the
// installed web app, and in the Play Store app (shown as Android notifications).
import api from "../lib/api";
import { isAppMode } from "./appMode";

const DISMISS_KEY = "yneet_push_card_dismissed";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushPermission = () => (pushSupported() ? Notification.permission : "unsupported");

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Is this device already subscribed?
export async function pushIsOn() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(reg && (await reg.pushManager.getSubscription()));
}

// Ask permission, subscribe, tell the server, then send a welcome notification.
// Returns "on" | "denied" | "unsupported" | "unavailable".
export async function enablePush() {
  if (!pushSupported()) return "unsupported";
  const { data } = await api.get("/push/public-key");
  if (!data.enabled || !data.key) return "unavailable";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.key) });
  await api.post("/push/subscribe", { subscription: sub.toJSON(), inApp: isAppMode });
  api.post("/push/test").catch(() => {});
  try { window.gtag?.("event", "push_enabled", { in_app: isAppMode }); } catch { /* ignore */ }
  return "on";
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

export const pushCardDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
export const dismissPushCard = () => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };
