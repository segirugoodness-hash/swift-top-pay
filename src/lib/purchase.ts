import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { vendPurchase } from "@/lib/vend.functions";

export type VendService = "airtime" | "data" | "electricity" | "cable" | "education";

export type PurchaseInput = {
  service: VendService;
  details: Record<string, unknown>;
  expectedRetail: number;
  pin: string;
  idempotencyKey: string;
  biometricChallengeId?: string;
};

/** All prices, vendor paths, wallet debits and settlements are verified by the server. */
export async function spendWallet(input: PurchaseInput): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    toast.error("Please sign in first");
    return false;
  }
  try {
    await vendPurchase({ data: input });
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Purchase could not be completed");
    return false;
  }
}