// YNeet service worker — makes the app installable and keeps the shell
// available offline. It never touches API calls or anything cross-origin, so
// logins, tests and answers always go straight to the network.
const VERSION = "yneet-v3";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

// Built-in copy of the offline page, used if Android cleared the cache. A page
// load must never end in Chrome's "This site can't be reached" (ERR_FAILED).
// It retries by itself as soon as the phone is back online, keeping the same
// URL, so a /bridge?token=… login link still works after a network blip.
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YNeet — Offline</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f3ff;color:#1e1b4b;text-align:center;padding:24px}.card{max-width:360px}h1{font-size:22px;margin:0 0 8px}p{color:#4b5563;line-height:1.5;margin:0 0 20px}button{background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:700}</style></head>
<body><div class="card"><h1>Connection problem</h1><p>YNeet couldn't load. Check your internet — we'll try again automatically.</p><button onclick="location.reload()">Try again</button></div>
<script>addEventListener("online",function(){location.reload()});setTimeout(function(){if(navigator.onLine)location.reload()},8000)</script></body></html>`;

const offlineResponse = async () =>
  (await caches.match("/offline.html")) ||
  new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Page loads: try the network, retry twice on a blip (mobile data often drops
// for a second), then show the offline page instead of a browser error.
async function navigate(req) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(req);
    } catch {
      if (attempt < 2) await wait(attempt === 0 ? 700 : 1500);
    }
  }
  return offlineResponse();
}

self.addEventListener("install", (event) => {
  // Cache what we can; one missing file must not stop the new worker installing.
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(SHELL_URLS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // API & third parties: network only
  if (url.pathname.startsWith("/api/")) return;

  // Page loads: network first (always fresh after a deploy), offline page as fallback.
  if (req.mode === "navigate") {
    event.respondWith(navigate(req).catch(offlineResponse));
    return;
  }

  // Built assets (hashed filenames) and icons: serve from cache, refresh in background.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached || Response.error());
        return cached || network;
      })
    );
  }
});

// ── Push notifications (Question of the Day, streak and trial reminders) ──
// Payload from the backend: { title, body, url, tag }. In the Play Store app,
// Chrome hands these to Android, so they look like normal app notifications.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "YNeet";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && "focus" in w) {
        await w.focus();
        if ("navigate" in w) return w.navigate(target.href);
        return;
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
