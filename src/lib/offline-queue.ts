/** Purchases require fresh authorization and must never be stored for automatic replay. */
export type QueuedVend = {
  id: string;
  createdAt: number;
  attempts: number;
  label: string;
  input: never;
};

export function queuedVends(): QueuedVend[] {
  return [];
}

export function subscribeToQueue(listener: (items: QueuedVend[]) => void): () => void {
  listener([]);
  return () => undefined;
}

export function enqueueVend(_label: string, _input: unknown): void {
  // Do not save a PIN, payment intent, or executable purchase to device storage.
}

export function clearQueue(): void {
  // Kept for older UI callers; there is no local payment queue anymore.
}

export function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("failed to fetch") || message.includes("network") || message.includes("offline");
}

export type DrainResult = { sent: number; failed: number; remaining: number };

export async function drainQueue(): Promise<DrainResult> {
  return { sent: 0, failed: 0, remaining: 0 };
}