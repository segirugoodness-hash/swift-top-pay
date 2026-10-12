import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/create-pin")({
  component: CreatePinPage,
});

function CreatePinPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pin.length !== 4) return toast.error("PIN must be 4 digits");
    if (pin !== confirm) return toast.error("PINs do not match");
    setBusy(true);
    const { error } = await supabase.rpc("set_transaction_pin", { _pin: pin });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transaction PIN created");
    qc.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground">
        {step === "choose" ? "Create transaction PIN" : "Confirm your PIN"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "choose"
          ? "You'll enter this 4-digit PIN each time you pay from your wallet."
          : "Re-enter the same 4 digits to confirm."}
      </p>

      <div className="mt-10 flex justify-center">
        {step === "choose" ? (
          <InputOTP maxLength={4} value={pin} onChange={setPin} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-14 w-12 text-xl" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        ) : (
          <InputOTP maxLength={4} value={confirm} onChange={setConfirm} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-14 w-12 text-xl" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
      </div>

      <Button
        className="mt-auto h-12 rounded-full text-base font-semibold"
        disabled={busy || (step === "choose" ? pin.length !== 4 : confirm.length !== 4)}
        onClick={() => (step === "choose" ? setStep("confirm") : submit())}
      >
        {busy ? "Saving…" : step === "choose" ? "Continue" : "Create PIN"}
      </Button>
    </div>
  );
}
