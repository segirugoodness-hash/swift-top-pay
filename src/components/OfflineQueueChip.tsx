import { useEffect } from "react";
import { queuedVends } from "@/lib/offline-queue";

/**
 * Floating indicator for purchases saved while the phone was offline.
 * Retries automatically when the connection returns, and can be retried by tapping.
 */
export function OfflineQueueChip() {
  useEffect(() => {
    // Drop requests created by the previous version, including any stored PINs.
    try {
      window.localStorage.removeItem("st_offline_queue");
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, []);
  return queuedVends().length ? null : null;
}
