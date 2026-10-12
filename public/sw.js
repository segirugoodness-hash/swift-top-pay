/* Swift Top app shell cache — keeps the installed app opening without a connection. */
const VERSION = "swift-top-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache data or server-function traffic.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? offlineResponse())),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => hit ?? Response.error()),
    ),
  );
});

function offlineResponse() {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Swift Top — offline</title></head>
     <body style="margin:0;font-family:system-ui;background:#111a2e;color:#e8eefc;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
     <div style="padding:24px"><h1 style="font-size:20px">You're offline</h1>
     <p style="opacity:.75;font-size:14px">Swift Top will load again as soon as you have a connection.</p></div>
     </body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" }, status: 200 },
  );
}
