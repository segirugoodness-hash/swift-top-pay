import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBiometricTransactionsEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles")
      .select("biometric_transactions_enabled").eq("id", context.userId).maybeSingle();
    if (error) throw new Error("Could not load payment security settings");
    return data?.biometric_transactions_enabled ?? false;
  });

export const setBiometricTransactionsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((enabled: boolean) => {
    if (typeof enabled !== "boolean") throw new Error("Choose whether payment biometrics are enabled");
    return enabled;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_biometric_transactions_enabled", { _enabled: data });
    if (error) throw new Error(error.message);
    return { enabled: data };
  });