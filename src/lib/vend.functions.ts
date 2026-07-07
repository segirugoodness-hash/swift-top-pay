import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Live vend engine.
 * Flow (atomic in the DB layer):
 *   1. acquire 45s service lock (anti-duplicate)
 *   2. begin_vend: verify PIN, debit wallet, insert 'pending' ledger row
 *   3. call Otapay
 *   4. complete_vend (routes markup profit to admin_earnings) OR fail_vend (auto-refund)
 *   5. release lock
 */
export const vendPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      service: string;                 // 'data' | 'airtime' | 'electricity' | 'cable' | 'education'
      retail: number;                  // amount to debit
      wholesale: number;               // otapay cost — used for profit calc
      pin: string;
      metadata: Record<string, unknown>;
      otapayEndpoint: string;          // e.g. '/v1/vend/data'
      otapayPayload: Record<string, unknown>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Anti-duplicate lock
    const { data: acquired, error: lockErr } = await supabase.rpc("try_acquire_service_lock", {
      _service_type: data.service,
    });
    if (lockErr) throw new Error(lockErr.message);
    if (!acquired) {
      throw new Error("Transaction processing. Please wait for confirmation to avoid duplicate charges.");
    }

    const reference = `stv_${data.service}_${userId.slice(0, 8)}_${Date.now()}`;

    try {
      // 2. Begin vend — verifies PIN, debits, creates pending row
      const { data: txnId, error: beginErr } = await supabase.rpc("begin_vend", {
        _type: data.service,
        _retail: data.retail,
        _wholesale: data.wholesale,
        _pin: data.pin,
        _reference: reference,
        _metadata: data.metadata as never,
      });
      if (beginErr) throw new Error(beginErr.message);
      const txn_id = txnId as unknown as string;

      // 3. Load Otapay config
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cfgRow } = await supabaseAdmin
        .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
      const cfg = (cfgRow?.value ?? {}) as { secret_key?: string; public_key?: string; base_url?: string };

      if (!cfg.secret_key) {
        // Refund immediately if provider not configured
        await supabase.rpc("fail_vend", { _txn_id: txn_id, _error: "Otapay not configured" });
        throw new Error("Payment provider not configured yet. Your wallet has been refunded.");
      }

      const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");

      // 4. Fire outbound call with a 25s hard timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      let providerRef: string | null = null;
      try {
        const res = await fetch(`${baseUrl}${data.otapayEndpoint}`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${cfg.secret_key}`,
            "Content-Type": "application/json",
            "X-Public-Key": cfg.public_key ?? "",
            "X-Reference": reference,
          },
          body: JSON.stringify({ ...data.otapayPayload, reference }),
        });
        clearTimeout(timer);
        const raw = await res.text();
        let json: Record<string, unknown> = {};
        try { json = JSON.parse(raw); } catch { /* leave empty */ }
        if (!res.ok || json.status === false || json.success === false) {
          const msg = String(json.message ?? json.error ?? raw.slice(0, 160) ?? `Otapay ${res.status}`);
          await supabase.rpc("fail_vend", { _txn_id: txn_id, _error: msg });
          throw new Error(`Vend failed: ${msg}`);
        }
        providerRef = String(json.reference ?? json.transaction_id ?? json.request_id ?? "") || null;
      } catch (e) {
        clearTimeout(timer);
        const msg = e instanceof Error ? e.message : "Network error";
        // fail_vend is idempotent (skips if already non-pending)
        await supabase.rpc("fail_vend", { _txn_id: txn_id, _error: msg });
        throw new Error(`Vend failed: ${msg}. Your wallet has been refunded.`);
      }

      // 5. Success — route profit
      const { error: doneErr } = await supabase.rpc("complete_vend", {
        _txn_id: txn_id,
        _provider_ref: providerRef ?? undefined,
      });
      if (doneErr) throw new Error(doneErr.message);

      return { ok: true, reference, txn_id, provider_ref: providerRef };
    } finally {
      await supabase.rpc("release_service_lock", { _service_type: data.service });
    }
  });

/** Read admin earnings — owner only (RLS enforces). */
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
