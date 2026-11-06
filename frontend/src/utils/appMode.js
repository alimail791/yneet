// "App mode" = the page is running inside the YNeet Android app from the Play
// Store (a Trusted Web Activity that opens /?source=twa).
//
// Google Play charges a service fee on digital subscriptions sold inside an
// app. YNeet runs the app "consumption only": no prices, no Buy/Renew buttons
// and no links to a payment page inside the Android app. Students and parents
// buy on www.yneet.in in a normal browser, and the plan simply works in the app.
//
// The flag lives in sessionStorage, NOT localStorage: a Trusted Web Activity
// shares Chrome's storage with the phone's normal Chrome browser, so a
// localStorage flag would also hide prices for the same person on the website.
const KEY = "yneet_app_mode";

function detect() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    const fromUrl = q.get("source") === "twa" || q.get("app") === "1";
    const fromReferrer = (document.referrer || "").startsWith("android-app://");
    if (fromUrl || fromReferrer) {
      sessionStorage.setItem(KEY, "1");
      return true;
    }
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const isAppMode = detect();

// Where to send someone who is not logged in. In the app they land straight on
// the login page (with app=1 so www.yneet.in also hides prices); on the web,
// the Raise Academy home page as before.
export function raiseEntryUrl(path = "") {
  const base = (import.meta.env.VITE_RAISE_ACADEMY_URL || "/").replace(/\/$/, "");
  // In the app, stay on app.yneet.in (the only site the app opens full screen):
  // /account shows the www.yneet.in login or sign-up page inside a frame.
  if (isAppMode) return `/account?page=${(path || "/login").replace(/^\//, "")}`;
  return path ? `${base}${path}` : (import.meta.env.VITE_RAISE_ACADEMY_URL || "/");
}

// The public website (www.yneet.in): the landing page students come back to.
export const WEBSITE_URL = (import.meta.env.VITE_RAISE_ACADEMY_URL || "https://www.yneet.in").replace(/\/$/, "") + "/";

// Where logout goes: www.yneet.in/logout signs the student out of the website
// too (the shared login lives there), then lands on the home page — or on the
// login page inside the Play Store app.
export function raiseLogoutUrl() {
  const base = (import.meta.env.VITE_RAISE_ACADEMY_URL || "").replace(/\/$/, "");
  if (isAppMode) return "/account?page=logout";
  if (!base) return "/";
  return `${base}/logout`;
}
