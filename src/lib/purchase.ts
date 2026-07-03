import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PurchaseInput = {
  type: string;
  amount: number;
  metadata?: Record<string, unknown>;
};

/** Validates wallet balance, deducts amount, records transaction. */
export async function spendWallet(input: PurchaseInput): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    toast.error("Please sign in first");
    return false;
  }
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", u.user.id)
    .maybeSingle();
  if (pErr || !profile) {
    toast.error("Could not read wallet balance");
    return false;
  }
  const balance = Number(profile.wallet_balance ?? 0);
  if (balance < input.amount) {
    toast.error(`Insufficient balance. You need ₦${input.amount.toLocaleString()}, you have ₦${balance.toLocaleString()}.`);
    return false;
  }
  const newBal = balance - input.amount;
  const { error: uErr } = await supabase
    .from("profiles")
    .update({ wallet_balance: newBal })
    .eq("id", u.user.id);
  if (uErr) {
    toast.error("Could not debit wallet");
    return false;
  }
  await supabase.from("transactions").insert({
    user_id: u.user.id,
    type: input.type,
    amount: input.amount,
    status: "success",
    metadata: input.metadata ?? {},
  });
  return true;
}
