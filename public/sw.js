// One-release cleanup for the former Swift Top app-shell worker.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      const oldSwiftTopCaches = names.filter((name) => name === "swift-top-v1" || name.startsWith("swift-top-"));
      await Promise.allSettled(oldSwiftTopCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
    } finally {
      await self.registration.unregister();
    }
  })());
});