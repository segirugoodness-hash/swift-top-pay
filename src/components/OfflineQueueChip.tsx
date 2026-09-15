import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { subscribeToQueue, drainQueue, type QueuedVend } from "@/lib/offline-queue";

/**
 * Floating indicator for purchases saved while the phone was offline.
 * Retries automatically when the connection returns, and can be retried by tapping.
 */
export function OfflineQueueChip() {
  const [items, setItems] = useState<QueuedVend[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToQueue(setItems), []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      drainQueue((label, ok, message) => {
        if (ok) toast.success(`${label} completed`);
        else toast.error(message ?? `${label} could not be completed — your wallet was not charged`);
      }).catch(() => undefined);
    };
    window.addEventListener("online", run);
    run();
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true);
        drainQueue((label, ok, message) => {
          if (ok) toast.success(`${label} completed`);
          else toast.error(message ?? `${label} could not be completed`);
        })
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
      className="fixed bottom-24 left-1/2 z-50 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground shadow-lg"
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : <CloudOff className="h-4 w-4 text-primary" />}
      {items.length} pending purchase{items.length > 1 ? "s" : ""} — tap to retry
    </button>
  );
}
