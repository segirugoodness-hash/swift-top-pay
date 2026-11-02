import { useEffect } from "react";

const CLEANUP_FLAG = "swift-top-sw-cleanup-v1";

function isPreview(): boolean {
  const host = window.location.hostname;
  return import.meta.env.DEV || host === "localhost" || host === "127.0.0.1" ||
    host.startsWith("id-preview--") || host.startsWith("preview--") ||
    host === "lovableproject.com" || host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev");
}

async function removeMatchingOldAppWorker(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const expectedScript = new URL("/sw.js", window.location.origin).href;
  const matches = registrations.filter((registration) =>
    registration.scope === `${window.location.origin}/` &&
    [registration.active, registration.waiting, registration.installing]
      .some((worker) => worker?.scriptURL === expectedScript),
  );
  await Promise.allSettled(matches.map((registration) => registration.unregister()));
}

export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (isPreview()) {
      void removeMatchingOldAppWorker().catch(() => undefined);
      return;
    }
    try {
      if (window.localStorage.getItem(CLEANUP_FLAG) === "1") return;
      navigator.serviceWorker.register("/sw.js").then(() => {
        window.localStorage.setItem(CLEANUP_FLAG, "1");
      }).catch(() => undefined);
    } catch {
      // Installability uses the manifest and does not depend on storage or a worker.
    }
  }, []);
  return null;
}