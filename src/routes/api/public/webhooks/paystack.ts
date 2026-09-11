import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const paystackEventSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.number().optional(),
    reference: z.string().min(1).optional(),
  }),
});

const verifiedPaymentSchema = z.object({
  status: z.literal(true),
  data: z.object({
    id: z.number(),
    reference: z.string().min(1),
    amount: z.number().positive(),
    status: z.literal("success"),
    metadata: z.object({ user_id: z.string().uuid(), purpose: z.literal("wallet_funding") }),
  }),
});

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

        let eventJson: unknown;
        try {
          eventJson = JSON.parse(raw);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        const parsedEvent = paystackEventSchema.safeParse(eventJson);
        if (!parsedEvent.success) return new Response("Invalid payload", { status: 400 });
        const evt = parsedEvent.data;
        if (evt.event !== "charge.success") return new Response("ok", { status: 200 });
        const reference = evt.data.reference;
        if (!reference) return new Response("Missing reference", { status: 400 });

        // Never trust payment status, amount or user metadata from the webhook body alone.
        const verificationResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${cfg.secret_key}` } },
        );
        const verificationJson: unknown = await verificationResponse.json().catch(() => null);
        const verified = verifiedPaymentSchema.safeParse(verificationJson);
        if (!verificationResponse.ok || !verified.success || verified.data.data.reference !== reference) {
          console.error("Paystack webhook verification failed", { reference });
          return new Response("Unable to verify payment", { status: 502 });
        }

        const payment = verified.data.data;
        const eventId = String(evt.data.id ?? payment.id);
        const amountNaira = payment.amount / 100;
        const { error: settlementError } = await supabaseAdmin.rpc("settle_paystack_funding", {
          _event_id: eventId,
          _reference: payment.reference,
          _user_id: payment.metadata.user_id,
          _amount: amountNaira,
          _raw: eventJson as never,
        });
        if (settlementError) {
          console.error("Paystack funding settlement failed", {
            reference,
            message: settlementError.message,
          });
          return new Response("Unable to settle payment", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
