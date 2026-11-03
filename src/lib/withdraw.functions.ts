import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Withdraw-to-bank request. The server verifies the transaction PIN, checks the
 * balance, debits the wallet atomically and records a pending withdrawal for
 * settlement. The client never supplies trusted amounts beyond the request input,
 * and the database function re-checks every rule.
 */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    amount: number;
    pin: string;
    bank: string;
    accountNumber: string;
    accountName: string;
  }) => {
    if (!input) throw new Error("Invalid withdrawal request");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
    if (!input.pin || !/^\d{4}$/.test(input.pin)) throw new Error("Enter your 4-digit transaction PIN");
    const bank = input.bank?.trim() ?? "";
    const accountNumber = input.accountNumber?.trim() ?? "";
    const accountName = input.accountName?.trim() ?? "";
    if (!bank) throw new Error("Enter the recipient bank name");
    if (!/^\d{10}$/.test(accountNumber)) throw new Error("Enter a valid 10-digit account number");
    if (!accountName) throw new Error("Enter the recipient account name");
    return { amount, pin: input.pin, bank, accountNumber, accountName };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: acquired, error: lockError } = await supabase.rpc("try_acquire_service_lock", {
      _service_type: "withdrawal",
    });
    if (lockError) throw new Error(lockError.message);
    if (!acquired) {
      throw new Error("A withdrawal is already being processed. Please wait a moment.");
    }

    try {
      const { data: txnId, error } = await supabase.rpc("request_withdrawal", {
        _amount: data.amount,
        _pin: data.pin,
        _bank_name: data.bank,
        _account_number: data.accountNumber,
        _account_name: data.accountName,
      });
      if (error) throw new Error(error.message);
      return { ok: true, txn_id: txnId as string };
    } finally {
      await supabase.rpc("release_service_lock", { _service_type: "withdrawal" });
    }
  });
