import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint hit daily by pg_cron. Re-runs the Otapay plan sync using service role
 * so no interactive auth is required. Protected by the Supabase anon apikey header.
 */
export const Route = createFileRoute("/api/public/hooks/otapay-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        if (!key || key !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfgRow } = await supabaseAdmin
          .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
        const cfg = (cfgRow?.value ?? {}) as { secret_key?: string; public_key?: string; base_url?: string };
        if (!cfg.secret_key) {
          return Response.json({ ok: false, error: "Otapay not configured" }, { status: 200 });
        }
        const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");

        const res = await fetch(`${baseUrl}/v1/data/plans`, {
          headers: { Authorization: `Bearer ${cfg.secret_key}`, "X-Public-Key": cfg.public_key ?? "" },
        });
        if (!res.ok) {
          return Response.json({ ok: false, status: res.status }, { status: 200 });
        }
        const json = (await res.json()) as { data?: unknown[]; plans?: unknown[] };
        const raw = (json.data ?? json.plans ?? []) as Record<string, unknown>[];

        const ALIAS: Record<string, string> = {
          mtn: "mtn", glo: "glo", airtel: "airtel", "9mobile": "9mobile", etisalat: "9mobile",
        };
        const rows = raw
          .map((p) => {
            const network = ALIAS[String(p.network ?? p.provider ?? "").toLowerCase()] ?? null;
            const external_id = String(p.id ?? p.plan_id ?? p.code ?? "");
            const price = Number(p.price ?? p.wholesale_price ?? p.amount ?? 0);
            if (!network || !external_id || !(price > 0)) return null;
            const validity = (p.validity ?? p.duration ?? null) as string | null;
            const v = (validity ?? "").toLowerCase();
            const category = /(month|30\s*day)/.test(v) ? "monthly"
              : /(week|7\s*day)/.test(v) ? "weekly"
              : /(3\s*day|72\s*hour)/.test(v) ? "three_day" : "daily";
            return {
              external_id, network, category,
              name: String(p.name ?? p.plan_name ?? p.size ?? external_id),
              wholesale_price: price, validity, is_active: true,
              updated_at: new Date().toISOString(),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        if (rows.length === 0) return Response.json({ ok: true, upserted: 0 });

        const { error, count } = await supabaseAdmin
          .from("data_plans").upsert(rows, { onConflict: "network,external_id", count: "exact" });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, upserted: count ?? rows.length });
      },
    },
  },
});
