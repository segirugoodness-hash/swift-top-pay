import { vendPurchase } from "@/lib/vend.functions";

/**
 * Offline purchase queue for airtime / data top-ups.
 *
 * When the phone drops off the network mid-purchase we keep the request on the device
 * and replay it as soon as connectivity returns. Every item carries a stable reference,
 * and the server-side vend engine refunds any request it cannot complete, so a replay
 * can never double-charge a wallet.
 */

const KEY = "st_offline_queue";
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // stale intents are dropped rather than replayed
const MAX_ATTEMPTS = 3;

export type QueuedVend = {
  id: string;
  createdAt: number;
  attempts: number;
  label: string;
  input: {
    service: string;
    retail: number;
    wholesale: number;
    pin: string;
    metadata: Record<string, unknown>;
    otapayEndpoint: string;
    otapayPayload: Record<string, unknown>;
  };
};

type Listener = (items: QueuedVend[]) => void;
const listeners = new Set<Listener>();

function read(): QueuedVend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? (JSON.parse(raw) as QueuedVend[]) : [];
    return items.filter((i) => Date.now() - i.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function write(items: QueuedVend[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked — the queue simply doesn't persist
  }
  listeners.forEach((l) => l(items));
}

export function queuedVends(): QueuedVend[] {
  return read();
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(read());
  return () => listeners.delete(listener);
}

export function enqueueVend(label: string, input: QueuedVend["input"]): void {
  const items = read();
  items.push({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
    label,
    input,
  });
  write(items);
}

export function clearQueue(): void {
  write([]);
}

/** True when the failure looks like lost connectivity rather than a rejected purchase. */
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = (error as Error)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("offline")
  );
}

let draining = false;

export type DrainResult = { sent: number; failed: number; remaining: number };

/** Replays every queued purchase. Safe to call repeatedly — it self-serialises. */
export async function drainQueue(
  onDone?: (label: string, ok: boolean, message?: string) => void,
): Promise<DrainResult> {
  if (draining) return { sent: 0, failed: 0, remaining: read().length };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { sent: 0, failed: 0, remaining: read().length };
  }
  draining = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const item of read()) {
      try {
        await vendPurchase({ data: item.input });
        write(read().filter((i) => i.id !== item.id));
        sent += 1;
        onDone?.(item.label, true);
      } catch (e) {
        if (isOfflineError(e)) break; // still offline — keep it for the next attempt
        const next = read().map((i) => (i.id === item.id ? { ...i, attempts: i.attempts + 1 } : i));
        write(next.filter((i) => i.id !== item.id || i.attempts < MAX_ATTEMPTS));
        failed += 1;
        onDone?.(item.label, false, (e as Error).message);
      }
    }
  } finally {
    draining = false;
  }
  return { sent, failed, remaining: read().length };
}
