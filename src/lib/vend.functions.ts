import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveVendQuote } from "@/lib/vend-pricing.server";
import { vendIntentString, type VendService } from "@/lib/vend-intent.server";

const SERVICE_TYPES = new Set<VendService>(["airtime", "data", "electricity", "cable", "education"]);

export const vendPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    service: VendService;
    details: Record<string, unknown>;
    pin: string;
    idempotencyKey: string;
    biometricChallengeId?: string;
  }) => {
    if (!input || !SERVICE_TYPES.has(input.service)) throw new Error("Unsupported purchase type");
    if (typeof input.pin !== "string" || !/^\d{4}$/.test(input.pin)) throw new Error("Enter your 4-digit transaction PIN");
    if (!input.details || typeof input.details !== "object' || Array.isArray(input.details)) throw new Error("Invalid purchase details");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const quote = await resolveVendQuote(supabase, data.service, data.details);
    const intentHash = await hashText(vendIntentString(data.service, quote.details, data.idempotencyKey));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_balance, biometric_transactions_enabled")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("Could not verify your wallet");
    if (Number(profile.wallet_balance) < quote.retail) throw new Error("Insufficient balance");

    let biometricChallengeId: string | null = null;
    if (profile.biometric_transactions_enabled) {
      if (!data.biometricChallengeId) throw new Error("Confirm this payment with your device biometric");
      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from("passkey_challenges")
        .select("id, purpose, user_id, intent_hash, expires_at, consumed_at, used_at")
        .eq("id", data.biometricChallengeId)
        .maybeSingle();
      if (challengeError || !challenge || challenge.purpose !== "payment" || challenge.user_id !== userId ||
          challenge.intent_hash !== intentHash || !challenge.consumed_at || challenge.used_at ||
          new Date(challenge.expires_at).getTime() <= Date.now()) {
        throw new Error("Biometric approval is missing, expired, or for another payment");
      }
      biometricChallengeId = challenge.id;
    } else if (data.biometricChallengeId) {
      throw new Error("Unexpected biometric approval");
    }

    const { data: acquired, error: lockErr } = await supabase.rpc("try_acquire_service_lock", {
      _service_type: data.service,
    });
    if (lockErr) throw new Error(lockErr.message);
    if (!acquired) throw new Error("Transaction processing. Please wait for confirmation to avoid duplicate charges.");

    const reference = `stv_${data.service}_${userId.slice(0, 8)}_${data.idempotencyKey}`;
    let txnId: string | null = null;
    try {
      const { data: newTxnId, error: beginErr } = await supabaseAdmin.rpc("begin_vend_authorized", {
        _user_id: userId,
        _type: data.service,
        _retail: quote.retail,
        _wholesale: quote.wholesale,
        _pin: data.pin,
        _reference: reference,
        _metadata: quote.metadata as never,
        _biometric_challenge_id: biometricChallengeId,
        _intent_hash: biometricChallengeId ? intentHash : null,
      });
      if (beginErr) throw new Error(beginErr.message);
      txnId = newTxnId;

      const { data: cfgRow, error: cfgError } = await supabaseAdmin
        .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
      if (cfgError) throw new Error("Could not load payment provider settings");
      const cfg = (cfgRow?.value ?? {}) as { secret_key?: string; public_key?: string; base_url?: string };
      if (!cfg.secret_key) throw new Error("Payment provider is not configured yet");

      const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");
      const providerUrl = new URL(quote.endpoint, baseUrl);
      if (providerUrl.origin !== new URL(baseUrl).origin) throw new Error("Invalid provider destination");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      let providerRef: string | null = null;
      try {
        const response = await fetch(providerUrl, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${cfg.secret_key}`,
            "Content-Type": "application/json",
            "X-Public-Key": cfg.public_key ?? "",
            "X-Reference": reference,
          },
          body: JSON.stringify({ ...quote.providerPayload, reference }),
        });
        const raw = await response.text();
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(raw) as Record<string, unknown>; } catch { /* Provider returned non-JSON */ }
        if (!response.ok || body.status === false || body.success === false) {
          const message = String(body.message ?? body.error ?? raw.slice(0, 160) ?? `Provider ${response.status}`);
          throw new Error(message);
        }
        providerRef = String(body.reference ?? body.transaction_id ?? body.request_id ?? "") || null;
      } finally {
        clearTimeout(timer);
      }

      const { error: completeError } = await supabaseAdmin.rpc("complete_vend", {
        _txn_id: txnId,
        _provider_ref: providerRef,
      });
      if (completeError) throw new Error("Provider completed the purchase; settlement is being reconciled");

      const email = context.claims["email"] as string | undefined;
      if (email) {
        try {
          const { sendEmail, receiptHtml } = await import("@/lib/email.server");
          await sendEmail({
            to: email,
            subject: `Swift Top receipt — ${data.service} ₦${quote.retail.toLocaleString()}`,
            html: receiptHtml({
              service: data.service,
              amount: quote.retail,
              reference: providerRef ?? reference,
              detail: Object.entries(quote.metadata)
                .filter(([, value]) => typeof value === "string" || typeof value === "number")
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(" · "),
            }),
          });
        } catch {
          // Receipt delivery is best effort and never reverses a successful vend.
        }
      }
      return { ok: true, reference, txn_id: txnId, provider_ref: providerRef, charged: quote.retail };
    } catch (error) {
      if (txnId) {
        const message = error instanceof Error ? error.message : "Payment failed";
        await supabaseAdmin.rpc("fail_vend", { _txn_id: txnId, _error: message.slice(0, 300) });
      }
      throw error;
    } finally {
      await supabase.rpc("release_service_lock", { _service_type: data.service });
    }
  });

async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const getAdminEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("admin_earnings")
      .select("balance, lifetime_revenue, updated_at")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { balance: 0, lifetime_revenue: 0, updated_at: null };
  });