import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "segiruabdulfathi558@gmail.com";

async function loadPaystackSecret(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("system_settings").select("value").eq("key", "paystack").maybeSingle();
  const v = (data?.value ?? {}) as { secret_key?: string };
  if (!v.secret_key) throw new Error("Paystack is not configured");
  return v.secret_key;
}

/** List Paystack banks so the admin can pick one. */
export const listPaystackBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (context.claims?.email !== OWNER_EMAIL) throw new Error("Forbidden");
    const secret = await loadPaystackSecret();
    const res = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=100", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j = (await res.json()) as { status: boolean; data: { name: string; code: string }[] };
    if (!j.status) throw new Error("Could not fetch banks");
    return j.data.map((b) => ({ name: b.name, code: b.code }));
  });

/** Resolve account name from bank + account number. */
export const resolvePaystackAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { account_number: string; bank_code: string }) => i)
  .handler(async ({ data, context }) => {
    if (context.claims?.email !== OWNER_EMAIL) throw new Error("Forbidden");
    const secret = await loadPaystackSecret();
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${data.account_number}&bank_code=${data.bank_code}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const j = (await res.json()) as {
      status: boolean; message?: string; data?: { account_name: string; account_number: string };
    };
    if (!j.status || !j.data) throw new Error(j.message ?? "Could not resolve account");
    return j.data;
  });

/**
 * Admin profit withdrawal via Paystack Transfer:
 *  1. PIN check + owner check
 *  2. Debit admin_earnings atomically
 *  3. Create transfer_recipient
 *  4. Initiate transfer
 *  5. On failure, credit earnings back
 */
export const withdrawAdminEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      amount: number; bank_code: string; account_number: string; account_name: string; pin: string;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    if (claims?.email !== OWNER_EMAIL) throw new Error("Forbidden");
    if (data.amount < 500) throw new Error("Minimum withdrawal is ₦500");

    // Verify PIN
    const { data: pinOk, error: pinErr } = await supabase.rpc("verify_transaction_pin", { _pin: data.pin });
    if (pinErr) throw new Error(pinErr.message);
    if (!pinOk) throw new Error("Incorrect transaction PIN");

    const secret = await loadPaystackSecret();

    // Debit earnings first (atomic; throws if insufficient)
    const { error: debErr } = await supabase.rpc("debit_admin_earnings", {
      _amount: data.amount,
      _note: `Payout to ${data.account_name} · ${data.account_number}`,
    });
    if (debErr) throw new Error(debErr.message);

    try {
      // Create recipient
      const recRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "nuban",
          name: data.account_name,
          account_number: data.account_number,
          bank_code: data.bank_code,
          currency: "NGN",
        }),
      });
      const recJ = (await recRes.json()) as { status: boolean; message?: string; data?: { recipient_code: string } };
      if (!recJ.status || !recJ.data) throw new Error(recJ.message ?? "Recipient failed");

      const reference = `payout_${userId.slice(0, 6)}_${Date.now()}`;
      const trRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(data.amount * 100),
          recipient: recJ.data.recipient_code,
          reason: "Swift Top profit payout",
          reference,
        }),
      });
      const trJ = (await trRes.json()) as { status: boolean; message?: string; data?: { transfer_code: string; status: string } };
      if (!trJ.status || !trJ.data) throw new Error(trJ.message ?? "Transfer failed");

      return { ok: true, reference, transfer_code: trJ.data.transfer_code, status: trJ.data.status };
    } catch (e) {
      // Refund earnings on any failure
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("credit_a2c_settlement" as never, {} as never).catch(() => {});
      // Manual refund via direct update as fail-safe
      await supabaseAdmin
        .from("admin_earnings")
        // @ts-expect-error dynamic rpc
        .update({ balance: (await supabaseAdmin.from("admin_earnings").select("balance").eq("id", "global").maybeSingle()).data!.balance + data.amount })
        .eq("id", "global");
      throw new Error(e instanceof Error ? e.message : "Transfer failed — refunded");
    }
  });
