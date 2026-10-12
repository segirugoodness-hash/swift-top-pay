import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The single Super Admin identity, mirrored in the database RLS policies and RPCs. */
export const SUPER_ADMIN_EMAIL = "segiruabdulfathi558@gmail.com";

function assertSuperAdmin(claims: Record<string, unknown>) {
  const email = typeof claims["email"] === "string" ? (claims["email"] as string) : "";
  if (email.toLowerCase() !== SUPER_ADMIN_EMAIL) throw new Error("Forbidden");
  return email;
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
  account_tier: string;
  verification_status: string;
  bvn_submitted: boolean;
  dedicated_account_number: string | null;
  created_at: string;
};

/**
 * Super-Admin user directory. Runs privileged (service role) *after* the caller's
 * email is verified, so per-user RLS never blocks the console.
 */
export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; pendingOnly?: boolean }) => input)
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const term = (data.search ?? "").trim();

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, phone, wallet_balance, account_tier, verification_status, bvn, dedicated_account_number, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (data.pendingOnly) query = query.eq("verification_status", "pending");
    if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Emails live in auth, not profiles — pull a page and map by id.
    const emails = new Map<string, string | null>();
    try {
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of page?.users ?? []) emails.set(u.id, u.email ?? null);
    } catch {
      // email column simply renders as "—" if the admin API is unavailable
    }

    let list: AdminUserRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      email: emails.get(r.id) ?? null,
      full_name: r.full_name,
      phone: r.phone,
      wallet_balance: Number(r.wallet_balance ?? 0),
      account_tier: r.account_tier,
      verification_status: r.verification_status,
      bvn_submitted: !!r.bvn,
      dedicated_account_number: r.dedicated_account_number,
      created_at: r.created_at,
    }));

    // Allow searching by email too (emails are not queryable in the profiles table).
    if (term && term.includes("@")) {
      const lower = term.toLowerCase();
      const matchIds = [...emails.entries()]
        .filter(([, e]) => (e ?? "").toLowerCase().includes(lower))
        .map(([id]) => id);
      if (matchIds.length) {
        const { data: byEmail } = await supabaseAdmin
          .from("profiles")
          .select(
            "id, full_name, phone, wallet_balance, account_tier, verification_status, bvn, dedicated_account_number, created_at",
          )
          .in("id", matchIds.slice(0, 50));
        list = (byEmail ?? []).map((r) => ({
          id: r.id,
          email: emails.get(r.id) ?? null,
          full_name: r.full_name,
          phone: r.phone,
          wallet_balance: Number(r.wallet_balance ?? 0),
          account_tier: r.account_tier,
          verification_status: r.verification_status,
          bvn_submitted: !!r.bvn,
          dedicated_account_number: r.dedicated_account_number,
          created_at: r.created_at,
        }));
      }
    }

    return list;
  });

/**
 * Manual wallet credit / debit. The database RPC re-checks the admin email,
 * writes the balance change and records it in the user's own history.
 */
export const adminAdjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; amount: number; reason: string }) => input)
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims as Record<string, unknown>);
    if (!Number.isFinite(data.amount) || data.amount === 0) throw new Error("Enter a non-zero amount");
    if (data.reason.trim().length < 3) throw new Error("A reason is required");

    const { data: balance, error } = await context.supabase.rpc("admin_adjust_wallet", {
      _user_id: data.userId,
      _amount: data.amount,
      _reason: data.reason.trim(),
    });
    if (error) throw new Error(error.message);
    return { balance: Number(balance ?? 0) };
  });

export type ProfitSummary = {
  lifetime: number;
  month: number;
  today: number;
  byService: { service: string; margin: number; count: number }[];
  recent: {
    id: string;
    service: string;
    charged: number;
    cost: number;
    margin: number;
    created_at: string;
    reference: string | null;
  }[];
};

/** Aggregated Otapay profit ledger for the Admin Dashboard. */
export const getProfitSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfitSummary> => {
    assertSuperAdmin(context.claims as Record<string, unknown>);

    const { data, error } = await context.supabase
      .from("admin_profits")
      .select("id, service, charged, cost, margin, created_at, reference")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    const byService = new Map<string, { margin: number; count: number }>();
    let lifetime = 0;
    let month = 0;
    let today = 0;

    for (const r of rows) {
      const m = Number(r.margin ?? 0);
      lifetime += m;
      if (r.created_at >= monthStart) month += m;
      if (r.created_at >= dayStart) today += m;
      const acc = byService.get(r.service) ?? { margin: 0, count: 0 };
      acc.margin += m;
      acc.count += 1;
      byService.set(r.service, acc);
    }

    return {
      lifetime,
      month,
      today,
      byService: [...byService.entries()]
        .map(([service, v]) => ({ service, ...v }))
        .sort((a, b) => b.margin - a.margin),
      recent: rows.slice(0, 15).map((r) => ({
        id: r.id,
        service: r.service,
        charged: Number(r.charged ?? 0),
        cost: Number(r.cost ?? 0),
        margin: Number(r.margin ?? 0),
        created_at: r.created_at,
        reference: r.reference,
      })),
    };
  });

/** Public: resolves a referrer's display name for the /signup landing greeting. */
export const getReferrerName = createServerFn({ method: "POST" })
  .inputValidator((input: { ref: string }) => input)
  .handler(async ({ data }) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(data.ref)) return { name: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.ref)
      .maybeSingle();
    if (!row) return { name: null as string | null };
    // Only a first name is exposed — never phone, email or balance.
    const first = (row.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return { name: first || "A Swift Top user" };
  });
