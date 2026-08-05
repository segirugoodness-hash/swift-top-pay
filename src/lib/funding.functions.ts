import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fundingReference,
  loadPaystackConfig,
  requestTemporaryAccount,
  safeEmail,
  transferExpiry,
  verifyPaystackReference,
} from "@/lib/funding.server";

/**
 * Mints a temporary virtual account for a one-off bank transfer top-up.
 * Crash-proof: any provider downtime degrades to a "queued" state instead of throwing.
 */
export const createTempTransferAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => input)
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    if (!data.amount || data.amount < 100) throw new Error("Minimum funding is ₦100");

    const email = safeEmail(claims?.email, userId);
    const reference = fundingReference(userId);
    const cfg = await loadPaystackConfig();

    const account = cfg.secret_key
      ? await requestTemporaryAccount({
          secretKey: cfg.secret_key,
          email,
          amountNaira: data.amount,
          reference,
        })
      : null;

    const expires_at = account?.expires_at ?? transferExpiry();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("funding_requests").insert({
      user_id: userId,
      amount: data.amount,
      account_number: account?.account_number ?? "PENDING",
      bank_name: account?.bank_name ?? "Awaiting provider",
      account_name: reference,
      status: "pending",
      expires_at,
    });

    return {
      reference,
      amount: data.amount,
      expires_at,
      available: !!account,
      account_number: account?.account_number ?? "",
      bank_name: account?.bank_name ?? "",
      account_name: account?.account_name ?? "",
    };
  });

/** Polled by the funding dialog while the temporary account is live. Never throws on provider errors. */
export const checkFundingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const cfg = await loadPaystackConfig();
    const remote = cfg.secret_key
      ? await verifyPaystackReference(cfg.secret_key, data.reference)
      : { status: "pending" as const, amount: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The webhook is the source of truth for crediting; a matching ledger row means the money landed.
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("reference", data.reference)
      .maybeSingle();

    const credited = txn?.status === "success" || remote.status === "success";
    if (credited) {
      await supabaseAdmin
        .from("funding_requests")
        .update({ status: "success" })
        .eq("user_id", userId)
        .eq("account_name", data.reference);
    }
    return { status: credited ? "success" : remote.status, amount: remote.amount };
  });
