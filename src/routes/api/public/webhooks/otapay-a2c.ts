import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Otapay Airtime-to-Cash settlement callback.
 * Called when Otapay confirms receipt of airtime at wholesale (~85%).
 * Splits: 80% -> user wallet, 5% -> admin_earnings.
 */
export const Route = createFileRoute("/api/public/webhooks/otapay-a2c")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load webhook secret (stored under system_settings.otapay.webhook_secret)
        const { data: cfgRow } = await supabaseAdmin
          .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
        const cfg = (cfgRow?.value ?? {}) as { webhook_secret?: string; secret_key?: string };
        const secret = cfg.webhook_secret ?? cfg.secret_key;

        // If a secret is configured, verify signature (accept multiple header names)
        if (secret) {
          const sig = request.headers.get("x-otapay-signature")
            ?? request.headers.get("x-signature") ?? "";
          const expected = createHmac("sha256", secret).update(raw).digest("hex");
          const a = Buffer.from(sig), b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        const reference = String(payload.reference ?? "");
        const status = String(payload.status ?? payload.event ?? "").toLowerCase();
        if (!reference) return new Response("Missing reference", { status: 400 });

        // Find the pending A2C ledger row
        const { data: txn } = await supabaseAdmin
          .from("transactions").select("*")
          .eq("reference", reference).maybeSingle();
        if (!txn) return new Response("ok", { status: 200 });

        if (status === "success" || status === "completed" || status === "confirmed") {
          const airtimeAmount = Number(
            ((txn.metadata as Record<string, unknown> | null) ?? {})["airtime_amount"] ?? 0,
          );
          // Mark original request row completed then credit split via RPC
          await supabaseAdmin.from("transactions")
            .update({ status: "success", metadata: { ...(txn.metadata as object), settled_at: new Date().toISOString() } })
            .eq("id", txn.id);
          await supabaseAdmin.rpc("credit_a2c_settlement", {
            _user_id: txn.user_id,
            _airtime_amount: airtimeAmount,
            _reference: `${reference}_settled`,
            _metadata: { original_reference: reference } as never,
          });
        } else if (status === "failed" || status === "rejected") {
          await supabaseAdmin.from("transactions")
            .update({ status: "failed", error_message: String(payload.message ?? "rejected") })
            .eq("id", txn.id);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
