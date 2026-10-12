import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";

/**
 * Instant client-side wallet pre-check.
 * Blocks the transaction PIN sheet from ever opening when the wallet cannot cover the price.
 * The server still re-checks the balance atomically during the vend.
 */
export function useBalanceGuard() {
  const { data: profile } = useProfile();
  const balance = Number(profile?.wallet_balance ?? 0);

  function ensureBalance(price: number): boolean {
    if (price > 0 && balance < price) {
      toast.error("Insufficient balance", {
        description: `You need ₦${(price - balance).toLocaleString()} more. Fund your wallet from the dashboard.`,
      });
      return false;
    }
    return true;
  }

  return { balance, ensureBalance };
}
