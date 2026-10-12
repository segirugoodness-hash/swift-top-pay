import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { vendPurchase } from "@/lib/vend.functions";
import { enqueueVend, isOfflineError } from "@/lib/offline-queue";

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

/** Flat service fee kept by Swift Top on bill payments (electricity, cable, education). */
export const BILL_SERVICE_FEE = 100;

/** Services billed as "provider cost + flat fee" rather than a wholesale plan price. */
const FEE_BASED = new Set(["electricity", "cable", "education"]);

/**
 * Client entry-point that goes through the atomic vend engine on the server.
 * Handles: anti-duplicate lock, PIN check, wallet debit, Otapay call, auto-refund on failure,
 * profit routing to admin_earnings / admin_profits, and offline queueing with auto-retry.
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

  // Bills: the provider is paid the face value, Swift Top keeps the flat fee as margin.
  const wholesale =
    input.wholesale ??
    (FEE_BASED.has(input.type) ? Math.max(0, retail - BILL_SERVICE_FEE) : retail);

  const payload = {
    service: input.type,
    retail,
    wholesale,
    pin: input.pin,
    metadata: input.metadata ?? {},
    otapayEndpoint: input.otapayEndpoint ?? defaultEndpoint,
    otapayPayload: input.otapayPayload ?? (input.metadata ?? {}),
  };

  try {
    await vendPurchase({ data: payload });
    return true;
  } catch (e) {
    if (isOfflineError(e)) {
      // Airtime and data are safe to replay: the engine refunds anything it cannot deliver.
      enqueueVend(`${input.type} purchase of ₦${retail.toLocaleString()}`, payload);
      toast.info("You're offline — we saved this purchase and will complete it automatically.");
      return true;
    }
    toast.error((e as Error).message);
    return false;
  }
}
