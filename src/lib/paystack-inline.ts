/** Shared Paystack Inline loader + checkout opener used by every funding surface. */
type PaystackPop = {
  setup: (opts: Record<string, unknown>) => { openIframe: () => void };
};

export function loadPaystack(): Promise<PaystackPop> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { PaystackPop?: PaystackPop };
    if (w.PaystackPop) return resolve(w.PaystackPop);
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve((window as unknown as { PaystackPop: PaystackPop }).PaystackPop);
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(s);
  });
}

/**
 * Opens the Paystack popup, falling back to a full-page redirect when the inline
 * script is blocked. Never throws for provider hiccups.
 */
export async function openPaystackCheckout(opts: {
  publicKey: string;
  accessCode: string;
  email: string;
  authorizationUrl: string;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const Paystack = await loadPaystack().catch(() => null);
  if (Paystack && opts.publicKey) {
    Paystack.setup({
      key: opts.publicKey,
      access_code: opts.accessCode,
      email: opts.email,
      onSuccess: opts.onSuccess,
      onCancel: opts.onCancel ?? (() => undefined),
    }).openIframe();
    return;
  }
  window.location.href = opts.authorizationUrl;
}
