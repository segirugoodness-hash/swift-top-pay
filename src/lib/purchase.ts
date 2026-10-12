import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { vendPurchase } from "@/lib/vend.functions";

export type PurchaseInput = {
  type: string;
  /** Retail price debited from the wallet. `amount` is a legacy alias. */
  amount?: number;
  retail?: number;
  wholesale?: number;                                // defaults to retail (no profit) if unknown
  pin: string;
  otapayEndpoint?: string;                           // e.g. '/v1/vend/airtime'
  otapayPayload?: Record<string, unknown>;
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
  const retail = Number(input.retail ?? input.amount ?? 0);
  if (!retail) { toast.error("Invalid amount"); return false; }
  // Default endpoint by service type
  const defaultEndpoint = ({
    data: "/v1/vend/data", airtime: "/v1/vend/airtime",
    electricity: "/v1/vend/electricity", cable: "/v1/vend/cable",
    education: "/v1/vend/education",
  } as Record<string, string>)[input.type] ?? `/v1/vend/${input.type}`;
  try {
    await vendPurchase({
      data: {
        service: input.type,
        retail,
        wholesale: input.wholesale ?? retail,
        pin: input.pin,
        metadata: input.metadata ?? {},
        otapayEndpoint: input.otapayEndpoint ?? defaultEndpoint,
        otapayPayload: input.otapayPayload ?? (input.metadata ?? {}),
      },
    });
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}
