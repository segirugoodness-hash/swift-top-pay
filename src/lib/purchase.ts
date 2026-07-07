import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { vendPurchase } from "@/lib/vend.functions";

export type PurchaseInput = {
  type: string;
  retail: number;
  wholesale?: number;                // defaults to retail (no profit) if unknown
  pin: string;
  otapayEndpoint: string;            // e.g. '/v1/vend/airtime'
  otapayPayload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Client entry-point that goes through the atomic vend engine on the server.
 * Handles: anti-duplicate lock, PIN check, wallet debit, Otapay call, auto-refund on failure,
 * and profit routing to admin_earnings on success.
 */
export async function spendWallet(input: PurchaseInput): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) { toast.error("Please sign in first"); return false; }
  try {
    await vendPurchase({
      data: {
        service: input.type,
        retail: input.retail,
        wholesale: input.wholesale ?? input.retail,
        pin: input.pin,
        metadata: input.metadata ?? {},
        otapayEndpoint: input.otapayEndpoint,
        otapayPayload: input.otapayPayload,
      },
    });
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}
