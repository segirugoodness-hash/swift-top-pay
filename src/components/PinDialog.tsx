import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Fingerprint } from "lucide-react";
import { useBiometrics } from "@/hooks/useBiometrics";
import { toast } from "sonner";
import { approvePaymentWithPasskey } from "@/lib/passkeys";
import type { VendService } from "@/lib/purchase";

export type PurchaseIntent = {
  service: VendService;
  details: Record<string, unknown>;
  expectedRetail: number;
  idempotencyKey: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  title?: string;
  description?: string;
  busy?: boolean;
  intent?: PurchaseIntent;
  onConfirm: (pin: string, biometricChallengeId?: string) => Promise<void> | void;
};

export function PinDialog({ open, onOpenChange, amount, title, description, busy, intent, onConfirm }: Props) {
  const [pin, setPin] = useState("");
  const { enabled, supported, loading: biometricLoading } = useBiometrics();
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (!open) setPin("");
  }, [open]);

  async function confirmPayment() {
    if (pin.length !== 4) return toast.error("Enter your 4-digit transaction PIN");
    if (busy || bioBusy) return;
    setBioBusy(true);
    try {
      let biometricChallengeId: string | undefined;
      if (enabled && supported) {
        if (!intent) throw new Error("Payment details are unavailable. Please reopen this purchase.");
        biometricChallengeId = await approvePaymentWithPasskey(intent);
      } else if (enabled) {
        throw new Error("This device cannot complete the required biometric approval. Turn it off in Profile to continue with your PIN.");
      }
      await onConfirm(pin, biometricChallengeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment approval failed");
    } finally {
      setBioBusy(false);
    }
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
          disabled={busy || bioBusy || biometricLoading || pin.length !== 4}
          onClick={() => { confirmPayment().catch(() => undefined); }}
          className="mt-6 h-12 w-full rounded-full text-base font-semibold"
        >
          {bioBusy ? <><Fingerprint className="mr-2 h-4 w-4" />{enabled ? "Confirming with biometrics…" : "Processing…"}</> : busy ? "Processing…" : `Confirm ₦${amount.toLocaleString()}`}
        </Button>
        {enabled && (
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Fingerprint className="h-4 w-4" /> Your PIN and a device biometric are both required
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

