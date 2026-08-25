import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "paystack")
          .maybeSingle();
        const cfg = (settings?.value ?? {}) as { secret_key?: string };
        if (!cfg.secret_key) return new Response("Paystack not configured", { status: 503 });

        const expected = createHmac("sha512", cfg.secret_key).update(raw).digest("hex");
        try {
          const a = Buffer.from(signature, "hex");
          const b = Buffer.from(expected, "hex");
          if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad sig");
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const evt = JSON.parse(raw) as {
          event: string;
          data: {
            id?: number;
            reference?: string;
            amount?: number;
            status?: string;
            metadata?: { user_id?: string };
            customer?: { email?: string };
          };
        };

        const eventId = String(evt.data?.id ?? evt.data?.reference ?? `${evt.event}:${Date.now()}`);

        // Idempotency guard
        const { data: existing } = await supabaseAdmin
          .from("paystack_events")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();
        if (existing) return new Response("ok", { status: 200 });

        const isCredit =
          (evt.event === "charge.success" || evt.event === "dedicatedaccount.credit") &&
          (evt.data?.status ?? "success") === "success" &&
          typeof evt.data?.amount === "number";

        if (isCredit) {
          const naira = (evt.data!.amount ?? 0) / 100;
          let userId = evt.data?.metadata?.user_id ?? null;
          if (!userId && evt.data?.customer?.email) {
            const { data: u } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("id", (await supabaseAdmin.auth.admin.listUsers()).data.users.find(
                (x) => x.email === evt.data!.customer!.email,
              )?.id ?? "")
              .maybeSingle();
            userId = u?.id ?? null;
          }
          if (userId && naira > 0) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("wallet_balance")
              .eq("id", userId)
              .maybeSingle();
            const newBal = Number(prof?.wallet_balance ?? 0) + naira;
            await supabaseAdmin.from("profiles").update({ wallet_balance: newBal }).eq("id", userId);
            await supabaseAdmin.from("transactions").insert({
              user_id: userId,
              type: "wallet_funding",
              amount: naira,
              status: "success",
              metadata: { source: "paystack", event: evt.event, reference: evt.data?.reference },
            });
            if (evt.data?.reference) {
              await supabaseAdmin
                .from("funding_requests")
                .update({ status: "completed" })
                .eq("account_name", evt.data.reference);
            }
            // First successful funding pays the referrer ₦10 (idempotent inside the DB routine).
            await supabaseAdmin.rpc("settle_referral_reward", { _funded_user: userId });
          }

        }

        await supabaseAdmin.from("paystack_events").insert({
          event_id: eventId,
          event_type: evt.event,
          reference: evt.data?.reference ?? null,
          user_id: evt.data?.metadata?.user_id ?? null,
          amount: evt.data?.amount ? evt.data.amount / 100 : null,
          raw: evt as never,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
