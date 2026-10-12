import { useEffect } from "react";

/**
 * Registers the app-shell service worker for the real app only.
 * Never registers inside the Lovable editor preview or local dev, where a cached
 * shell would serve stale builds.
 */
function isRealApp(): boolean {
  const host = window.location.hostname;
  if (import.meta.env.DEV) return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.includes("lovable.dev") || host.includes("lovableproject.com") || host.includes("lovable.app")) {
    // Published Lovable apps live on *.lovable.app; editor previews use the id-preview- prefix.
    return host.endsWith(".lovable.app") && !host.startsWith("id-preview--");
  }
  return true;
}

export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!isRealApp()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => undefined);
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
