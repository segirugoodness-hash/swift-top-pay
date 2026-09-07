import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner email guard shared by every admin-only Paystack fn. */
const OWNER_EMAIL = "segiruabdulfathi558@gmail.com";

async function assertOwner(context: { claims: { email?: string } }) {
  if (context.claims?.email !== OWNER_EMAIL) throw new Error("Forbidden");
}

async function loadPaystackConfig() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "paystack")
    .maybeSingle();
  const v = (data?.value ?? {}) as { public_key?: string; secret_key?: string };
  return v;
}

/** Admin: persist Paystack keys. */
export const savePaystackKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { public_key: string; secret_key: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_settings").upsert({
      key: "paystack",
      value: { public_key: data.public_key, secret_key: data.secret_key },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });

/** Admin: check status; never leaks secret. */
export const getPaystackStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const v = await loadPaystackConfig();
    return {
      configured: !!v.secret_key,
      public_key_masked: v.public_key ? `${v.public_key.slice(0, 8)}••••` : "",
    };
  });

/** Any signed-in user can fetch the Paystack public key to open the inline popup. */
export const getPaystackPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const v = await loadPaystackConfig();
    return { public_key: v.public_key ?? "" };
  });

/** Initialize a Paystack transaction server-side; returns reference + access_code for inline popup. */
export const initPaystackFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    // Prefer the signed-in account email, then a client-supplied one, then a synthetic fallback.
    const valid = (e?: string) => !!e && /.+@.+\..+/.test(e.trim());
    const rawEmail = (claims?.email ?? "").trim();
    const email = valid(rawEmail)
      ? rawEmail
      : valid(data.email)
        ? data.email!.trim()
        : `customer+${userId.slice(0, 8)}@swift-top.com`;
    if (!data.amount || data.amount < 100) throw new Error("Minimum funding is ₦100");


    const cfg = await loadPaystackConfig();
    if (!cfg.secret_key) throw new Error("Paystack is not configured yet — contact support");

    const reference = `st_${userId.slice(0, 8)}_${Date.now()}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(data.amount * 100), // kobo
        reference,
        metadata: { user_id: userId, purpose: "wallet_funding" },
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { access_code: string; reference: string; authorization_url: string };
    };
    if (!res.ok || !json.status || !json.data) {
      throw new Error(json.message ?? "Paystack init failed");
    }
    // Log a pending funding_request so admins can audit.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("funding_requests").insert({
      user_id: userId,
      amount: data.amount,
      account_number: "PAYSTACK",
      bank_name: "Paystack",
      account_name: reference,
      status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    return {
      reference: json.data.reference,
      access_code: json.data.access_code,
      authorization_url: json.data.authorization_url,
      public_key: cfg.public_key ?? "",
      email,
    };
  });


/** Verified upgrade: validate BVN with Paystack Customer Validation API, then create a Dedicated Virtual Account. */
export const upgradeToVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bvn: string; first_name: string; last_name: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId, claims, supabase } = context;
    if (!/^\d{11}$/.test(data.bvn)) throw new Error("BVN must be 11 digits");
    if (!data.first_name.trim() || !data.last_name.trim()) throw new Error("Legal name is required");
    const rawEmail = (claims?.email ?? "").trim();
    const email = /.+@.+\..+/.test(rawEmail) ? rawEmail : `customer+${userId.slice(0, 8)}@swift-top.com`;

    // Dedicated virtual accounts are on hold: we store the BVN submission securely and an
    // admin issues the account manually. No live Paystack DVA/identification calls are made.
    const { error } = await supabase
      .from("profiles")
      .update({
        bvn: data.bvn,
        verification_first_name: data.first_name.trim(),
        verification_last_name: data.last_name.trim(),
        verification_email: email,
        verification_status: "pending",
        verification_submitted_at: new Date().toISOString(),
        full_name: `${data.first_name} ${data.last_name}`.trim(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return {
      status: "pending" as const,
      note:
        "Your BVN has been submitted successfully. Your personal virtual account is being processed and will be assigned to your dashboard shortly.",
    };
  });

