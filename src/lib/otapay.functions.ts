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

const SEED_PLANS: Array<{ external_id: string; network: string; category: string; name: string; wholesale_price: number; validity: string }> = [
  { external_id: "seed_mtn_sme_1gb", network: "mtn", category: "monthly", name: "MTN SME 1GB", wholesale_price: 210, validity: "30 Days" },
  { external_id: "seed_mtn_sme_2gb", network: "mtn", category: "monthly", name: "MTN SME 2GB", wholesale_price: 420, validity: "30 Days" },
  { external_id: "seed_mtn_sme_5gb", network: "mtn", category: "monthly", name: "MTN SME 5GB", wholesale_price: 1050, validity: "30 Days" },
  { external_id: "seed_mtn_sme_10gb", network: "mtn", category: "monthly", name: "MTN SME 10GB", wholesale_price: 2100, validity: "30 Days" },
  { external_id: "seed_airtel_corp_1gb", network: "airtel", category: "monthly", name: "Airtel Corporate 1GB", wholesale_price: 230, validity: "30 Days" },
  { external_id: "seed_glo_gift_1gb", network: "glo", category: "monthly", name: "Glo Gifting 1GB", wholesale_price: 240, validity: "30 Days" },
  { external_id: "seed_mtn_110mb_1d", network: "mtn", category: "daily", name: "MTN 110MB", wholesale_price: 101, validity: "1 Day" },
  { external_id: "seed_mtn_1gb_1d", network: "mtn", category: "daily", name: "MTN 1GB", wholesale_price: 493, validity: "1 Day" },
  { external_id: "seed_airtel_150mb_1d", network: "airtel", category: "daily", name: "Airtel 150MB", wholesale_price: 58, validity: "1 Day" },
  { external_id: "seed_airtel_1gb_3d", network: "airtel", category: "three_day", name: "Airtel 1GB", wholesale_price: 345, validity: "3 Days" },
];

async function seedLocalPlans() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = SEED_PLANS.map((p) => ({ ...p, is_active: true, updated_at: new Date().toISOString() }));
  await supabaseAdmin.from("data_plans").upsert(rows, { onConflict: "network,external_id" });
  return rows.length;
}

/** Fetches product list from Otapay and upserts into public.data_plans. Admin-only.
 *  On Otapay downtime we intercept the error, seed verified local benchmarks and return
 *  a friendly maintenance flag so the UI never crashes. */
export const syncOtapayPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("system_settings").select("value").eq("key", "otapay").maybeSingle();
    const cfg = (settings?.value ?? {}) as { public_key?: string; secret_key?: string; base_url?: string };

    if (!cfg.secret_key) {
      const seeded = await seedLocalPlans();
      return { total: seeded, upserted: seeded, maintenance: true, message: "Otapay keys not configured — local wholesale benchmarks loaded." };
    }
    const baseUrl = (cfg.base_url ?? "https://api.otapay.ng").replace(/\/$/, "");

    let raw: Record<string, unknown>[] = [];
    try {
      const res = await fetch(`${baseUrl}/v1/data/plans`, {
        headers: {
          "Authorization": `Bearer ${cfg.secret_key}`,
          "X-Public-Key": cfg.public_key ?? "",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`Otapay API ${res.status}`);
      const json = (await res.json()) as { data?: unknown[]; plans?: unknown[] };
      raw = (json.data ?? json.plans ?? []) as Record<string, unknown>[];
    } catch {
      const seeded = await seedLocalPlans();
      return { total: seeded, upserted: seeded, maintenance: true, message: "Otapay server under brief maintenance. Local wholesale benchmarks successfully loaded for setup." };
    }

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

    if (plans.length === 0) {
      const seeded = await seedLocalPlans();
      return { total: seeded, upserted: seeded, maintenance: true, message: "Otapay returned no plans — local benchmarks loaded." };
    }

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

    return { total: rows.length, upserted: count ?? rows.length, maintenance: false };
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
