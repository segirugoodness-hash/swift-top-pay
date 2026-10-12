import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Fingerprint } from "lucide-react";
import { useBiometrics } from "@/hooks/useBiometrics";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  title?: string;
  description?: string;
  busy?: boolean;
  onConfirm: (pin: string) => Promise<void> | void;
};

export function PinDialog({ open, onOpenChange, amount, title, description, busy, onConfirm }: Props) {
  const [pin, setPin] = useState("");
  const { enabled, pinSaved, unlockPin } = useBiometrics();
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (!open) setPin("");
  }, [open]);

  async function payWithBiometrics() {
    setBioBusy(true);
    const saved = await unlockPin();
    setBioBusy(false);
    if (!saved) return toast.error("Biometric check failed — enter your PIN instead");
    await onConfirm(saved);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8 pt-6">
        <SheetHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <SheetTitle className="font-display">{title ?? "Enter transaction PIN"}</SheetTitle>
          <SheetDescription>
            {description ?? `Confirm payment of ₦${amount.toLocaleString()} with your 4-digit PIN.`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex justify-center">
          <InputOTP maxLength={4} value={pin} onChange={setPin} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-14 w-12 text-xl" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          disabled={busy || pin.length !== 4}
          onClick={() => onConfirm(pin)}
          className="mt-6 h-12 w-full rounded-full text-base font-semibold"
        >
          {busy ? "Processing…" : `Confirm ₦${amount.toLocaleString()}`}
        </Button>
        {enabled && pinSaved && (
          <Button
            variant="outline"
            disabled={busy || bioBusy}
            onClick={payWithBiometrics}
            className="mt-3 h-12 w-full rounded-full text-base font-semibold"
          >
            <Fingerprint className="mr-2 h-5 w-5" />
            {bioBusy ? "Waiting…" : "Use Face ID / Fingerprint"}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

