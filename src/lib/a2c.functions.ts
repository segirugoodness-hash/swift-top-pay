import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Initiates an Airtime-to-Cash request via Otapay.
 * Otapay will asynchronously deliver the airtime credit outcome via the webhook route
 * /api/public/webhooks/otapay-a2c which credits the wallet + admin earnings split.
 */
export const submitA2C = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { network: string; sender_phone: string; airtime_amount: number }) => i,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.sender_phone.length !== 11) throw new Error("Sender phone must be 11 digits");
    if (data.airtime_amount < 100) throw new Error("Minimum airtime is ₦100");

    const { data: locked } = await supabase.rpc("try_acquire_service_lock", { _service_type: "a2c" });
    if (!locked) throw new Error("A recent request is still processing — please wait.");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cfgRow } = await supabaseAdmin
        .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
      const cfg = (cfgRow?.value ?? {}) as { secret_key?: string; base_url?: string; public_key?: string };
      if (!cfg.secret_key) throw new Error("Otapay is not configured");

      const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");
      const reference = `a2c_${userId.slice(0, 8)}_${Date.now()}`;

      // Log pending ledger row so the user sees history
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "airtime_to_cash_request",
        amount: Math.round(data.airtime_amount * 0.8 * 100) / 100,
        status: "pending",
        reference,
        metadata: {
          network: data.network,
          sender_phone: data.sender_phone,
          airtime_amount: data.airtime_amount,
          expected_payout_pct: 80,
        },
      });

      const res = await fetch(`${baseUrl}/v1/a2c/request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.secret_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference,
          network: data.network,
          sender: data.sender_phone,
          amount: data.airtime_amount,
          callback_url: undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Otapay A2C ${res.status}: ${txt.slice(0, 160)}`);
      }
      const json = (await res.json()) as { instructions?: string; recipient_phone?: string };
      return {
        ok: true,
        reference,
        expected_payout: Math.round(data.airtime_amount * 0.8),
        instructions: json.instructions ?? `Transfer ₦${data.airtime_amount} airtime to the number provided by Otapay.`,
        recipient_phone: json.recipient_phone ?? null,
      };
    } finally {
      await supabase.rpc("release_service_lock", { _service_type: "a2c" });
    }
  });
