import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OtapayPlan = {
  external_id: string;
  network: string; // mtn | glo | airtel | 9mobile
  category: string; // daily | three_day | weekly | monthly
  name: string;
  wholesale_price: number;
  validity?: string | null;
};

const NETWORK_ALIASES: Record<string, string> = {
  mtn: "mtn", MTN: "mtn",
  glo: "glo", GLO: "glo",
  airtel: "airtel", AIRTEL: "airtel",
  "9mobile": "9mobile", "9MOBILE": "9mobile", etisalat: "9mobile",
};

function normalizeCategory(validity?: string | null, raw?: string): string {
  const v = (validity ?? raw ?? "").toLowerCase();
  if (/(month|30\s*day)/.test(v)) return "monthly";
  if (/(week|7\s*day)/.test(v)) return "weekly";
  if (/(3\s*day|72\s*hour)/.test(v)) return "three_day";
  return "daily";
}

/** Fetches product list from Otapay and upserts into public.data_plans. Admin-only. */
export const syncOtapayPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "otapay")
      .maybeSingle();
    if (sErr) throw sErr;
    const cfg = (settings?.value ?? {}) as { public_key?: string; secret_key?: string; base_url?: string };

    if (!cfg.secret_key) throw new Error("Otapay API keys not configured");
    const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/v1/data/plans`, {
      headers: {
        "Authorization": `Bearer ${cfg.secret_key}`,
        "X-Public-Key": cfg.public_key ?? "",
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Otapay API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: unknown[]; plans?: unknown[] };
    const raw = (json.data ?? json.plans ?? []) as Record<string, unknown>[];

    const plans: OtapayPlan[] = raw
      .map((p) => {
        const network = NETWORK_ALIASES[String(p.network ?? p.provider ?? "").toLowerCase()] ?? null;
        if (!network) return null;
        const external_id = String(p.id ?? p.plan_id ?? p.code ?? "");
        if (!external_id) return null;
        const validity = (p.validity ?? p.duration ?? null) as string | null;
        return {
          external_id,
          network,
          category: normalizeCategory(validity, String(p.category ?? "")),
          name: String(p.name ?? p.plan_name ?? p.size ?? external_id),
          wholesale_price: Number(p.price ?? p.wholesale_price ?? p.amount ?? 0),
          validity,
        } as OtapayPlan;
      })
      .filter((x): x is OtapayPlan => !!x && x.wholesale_price > 0);

    if (plans.length === 0) return { inserted: 0, updated: 0, total: 0 };

    const rows = plans.map((p) => ({
      external_id: p.external_id,
      network: p.network,
      category: p.category,
      name: p.name,
      wholesale_price: p.wholesale_price,
      validity: p.validity ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error: upErr, count } = await supabaseAdmin
      .from("data_plans")
      .upsert(rows, { onConflict: "network,external_id", count: "exact" });
    if (upErr) throw upErr;

    return { total: rows.length, upserted: count ?? rows.length };
  });

/** Saves Otapay API keys to system_settings (admin only). */
export const saveOtapayKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { public_key: string; secret_key: string; base_url?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_settings").upsert({
      key: "otapay",
      value: {
        public_key: data.public_key,
        secret_key: data.secret_key,
        base_url: data.base_url ?? "https://api.otapay.ng",
      },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });

/** Returns whether Otapay keys are configured (never returns the secret). */
export const getOtapayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("value, updated_at")
      .eq("key", "otapay")
      .maybeSingle();
    const v = (data?.value ?? {}) as { public_key?: string; secret_key?: string; base_url?: string };
    return {
      configured: !!v.secret_key,
      public_key_masked: v.public_key ? `${v.public_key.slice(0, 6)}••••` : "",
      base_url: v.base_url ?? "https://api.otapay.ng",
      updated_at: data?.updated_at ?? null,
    };
  });
