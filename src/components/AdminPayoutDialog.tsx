import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { BadgeCheck, Banknote } from "lucide-react";
import { toast } from "sonner";
import { listPaystackBanks, resolvePaystackAccount, withdrawAdminEarnings } from "@/lib/admin-payout.functions";

export function AdminPayoutDialog({
  open, onOpenChange, balance, onSuccess,
}: { open: boolean; onOpenChange: (v: boolean) => void; balance: number; onSuccess: () => void }) {
  const banksFn = useServerFn(listPaystackBanks);
  const resolveFn = useServerFn(resolvePaystackAccount);
  const withdrawFn = useServerFn(withdrawAdminEarnings);

  const { data: banks = [] } = useQuery({ queryKey: ["paystack_banks"], queryFn: () => banksFn(), enabled: open });

  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [acct, setAcct] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function resolve() {
    if (!bankCode || acct.length !== 10) return;
    setResolving(true);
    try {
      const r = await resolveFn({ data: { account_number: acct, bank_code: bankCode } });
      setName(r.account_name);
    } catch (e) { setName(""); toast.error((e as Error).message); }
    finally { setResolving(false); }
  }

  async function submit() {
    const amt = Number(amount);
    if (!amt || amt < 500) return toast.error("Minimum ₦500");
    if (amt > balance) return toast.error("Exceeds earnings balance");
    if (!bankCode || acct.length !== 10 || !name) return toast.error("Complete bank details");
    if (pin.length !== 4) return toast.error("Enter your 4-digit PIN");
    setBusy(true);
    try {
      const r = await withdrawFn({
        data: { amount: amt, bank_code: bankCode, account_number: acct, account_name: name, pin },
      });
      toast.success(`Transfer ${r.status} · ${r.reference}`);
      onSuccess();
      onOpenChange(false);
      setAmount(""); setBankCode(""); setAcct(""); setName(""); setPin("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-border bg-background pb-8 pt-6">
        <SheetHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Banknote className="h-6 w-6" />
          </div>
          <SheetTitle className="font-display">Withdraw profits</SheetTitle>
          <SheetDescription>Available: ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="mb-1 block text-xs">Amount (₦)</Label>
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Bank</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={bankCode}
              onChange={(e) => { setBankCode(e.target.value); setName(""); }}
            >
              <option value="">Select bank</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Account number</Label>
            <Input inputMode="numeric" maxLength={10} value={acct}
              onChange={(e) => { setAcct(e.target.value.replace(/\D/g, "")); setName(""); }}
              onBlur={resolve} />
            {resolving && <p className="mt-1 text-[11px] text-muted-foreground">Verifying…</p>}
            {name && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                <BadgeCheck className="h-3 w-3" /> {name}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1 block text-xs">Transaction PIN</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={4} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  {[0,1,2,3].map((i) => <InputOTPSlot key={i} index={i} className="h-11 w-11" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button className="mt-2 h-12 w-full rounded-full text-base font-semibold" disabled={busy} onClick={submit}>
            {busy ? "Processing…" : `Payout ₦${Number(amount || 0).toLocaleString()}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
