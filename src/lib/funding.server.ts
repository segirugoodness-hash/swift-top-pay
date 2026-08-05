/** Server-only helpers for the wallet funding flows (never imported by client code). */

export type PaystackConfig = { public_key?: string; secret_key?: string };

export async function loadPaystackConfig(): Promise<PaystackConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "paystack")
    .maybeSingle();
  return (data?.value ?? {}) as PaystackConfig;
}

export function safeEmail(rawEmail: string | undefined, userId: string): string {
  const e = (rawEmail ?? "").trim();
  return /.+@.+\..+/.test(e) ? e : `customer+${userId.slice(0, 8)}@swift-top.com`;
}

/** 30 minutes from now, ISO. */
export function transferExpiry(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

export function fundingReference(userId: string): string {
  return `stf_${userId.slice(0, 8)}_${Date.now()}`;
}

type ChargeResponse = {
  status: boolean;
  message?: string;
  data?: {
    status?: string;
    reference?: string;
    account_name?: string;
    account_number?: string;
    bank?: { name?: string; slug?: string };
    account_expires_at?: string;
  };
};

/**
 * Attempts a Paystack bank-transfer charge to mint a temporary (dynamic) account number.
 * Returns null when Paystack is unavailable or the account tier does not allow it —
 * callers must degrade gracefully instead of crashing.
 */
export async function requestTemporaryAccount(args: {
  secretKey: string;
  email: string;
  amountNaira: number;
  reference: string;
}): Promise<{ account_number: string; bank_name: string; account_name: string; expires_at: string } | null> {
  try {
    const res = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: { Authorization: `Bearer ${args.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: args.email,
        amount: Math.round(args.amountNaira * 100),
        reference: args.reference,
        bank_transfer: {},
      }),
    });
    const json = (await res.json()) as ChargeResponse;
    const d = json.data;
    if (!res.ok || !json.status || !d?.account_number) return null;
    return {
      account_number: d.account_number,
      bank_name: d.bank?.name ?? "Wema Bank",
      account_name: d.account_name ?? "Swift Top / Paystack Checkout",
      expires_at: d.account_expires_at ?? transferExpiry(),
    };
  } catch {
    return null;
  }
}

/** Verifies a Paystack transaction reference. Never throws. */
export async function verifyPaystackReference(
  secretKey: string,
  reference: string,
): Promise<{ status: "success" | "pending" | "failed"; amount: number }> {
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const json = (await res.json()) as { status?: boolean; data?: { status?: string; amount?: number } };
    const s = json.data?.status;
    const amount = (json.data?.amount ?? 0) / 100;
    if (s === "success") return { status: "success", amount };
    if (s === "failed" || s === "reversed") return { status: "failed", amount };
    return { status: "pending", amount };
  } catch {
    return { status: "pending", amount: 0 };
  }
}
