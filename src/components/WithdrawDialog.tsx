import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PinDialog } from "@/components/PinDialog";
import { spendWallet } from "@/lib/purchase";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function WithdrawDialog({ open, onOpenChange }: Props) {
  const { data: profile } = useProfile();
  const balance = Number(profile?.wallet_balance ?? 0);
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const amt = Number(amount) || 0;

  function proceed() {
    if (amt < 100) return toast.error("Minimum withdrawal is ₦100");
    if (amt > balance) return toast.error("Insufficient balance");
    if (!bank.trim() || accountNumber.length < 10 || !accountName.trim()) {
      return toast.error("Enter complete bank details");
    }
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    setBusy(true);
    try {
      const ok = await spendWallet({
        type: "withdrawal",
        amount: amt,
        pin,
        metadata: { bank, account_number: accountNumber, account_name: accountName },
      });
      if (ok) {
        toast.success("Withdrawal request submitted");
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        setPinOpen(false);
        onOpenChange(false);
        setAmount(""); setBank(""); setAccountNumber(""); setAccountName("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8 pt-6">
          <SheetHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <SheetTitle className="font-display">Withdraw to bank</SheetTitle>
            <SheetDescription>Available balance: ₦{balance.toLocaleString()}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-3">
            <div>
              <Label>Amount (₦)</Label>
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </div>
            <div>
              <Label>Bank name</Label>
              <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. GTBank" />
            </div>
            <div>
              <Label>Account number</Label>
              <Input inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" />
            </div>
            <div>
              <Label>Account name</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Recipient name" />
            </div>
          </div>
          <Button onClick={proceed} className="mt-6 h-12 w-full rounded-full text-base font-semibold">
            Continue
          </Button>
        </SheetContent>
      </Sheet>
      <PinDialog
        open={pinOpen}
        onOpenChange={(v) => { if (!busy) setPinOpen(v); }}
        amount={amt}
        title="Confirm withdrawal"
        description={`Enter your PIN to withdraw ₦${amt.toLocaleString()} to ${bank}.`}
        busy={busy}
        onConfirm={confirm}
      />
    </>
  );
}
