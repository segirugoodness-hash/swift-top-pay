import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { KeyRound, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "pins" | "otp";

export function ChangePinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<Step>("pins");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function reset() {
    setStep("pins"); setCurrent(""); setNext(""); setConfirm(""); setCode(""); setCooldown(0);
  }

  async function sendCode() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const addr = u.user?.email ?? "";
      if (!addr) throw new Error("No email on this account");
      setEmail(addr);
      const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false } });
      if (error) throw error;
      setStep("otp");
      setCooldown(60);
      toast.success("Security code sent to your email");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startChange() {
    if (current.length !== 4) return toast.error("Enter your current 4-digit PIN");
    if (next.length !== 4) return toast.error("New PIN must be 4 digits");
    if (next !== confirm) return toast.error("New PINs do not match");
    if (next === current) return toast.error("New PIN must be different from current");
    setBusy(true);
    const { data: valid, error } = await supabase.rpc("verify_transaction_pin", { _pin: current });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!valid) return toast.error("Current PIN is incorrect");
    await sendCode();
  }

  async function confirmChange() {
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (otpErr) throw otpErr;
      const { error } = await supabase.rpc("change_transaction_pin", { _current: current, _new: next });
      if (error) throw error;
      toast.success("Transaction PIN updated");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8 pt-6">
        <SheetHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {step === "pins" ? <KeyRound className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
          </div>
          <SheetTitle className="font-display">
            {step === "pins" ? "Change transaction PIN" : "Confirm it's you"}
          </SheetTitle>
          <SheetDescription>
            {step === "pins"
              ? "Verify your current PIN, then choose a new one."
              : `Enter the 6-digit code we sent to ${email}.`}
          </SheetDescription>
        </SheetHeader>

        {step === "pins" ? (
          <>
            <div className="mt-5 space-y-4">
              <Field label="Current PIN" value={current} onChange={setCurrent} />
              <Field label="New PIN" value={next} onChange={setNext} />
              <Field label="Confirm new PIN" value={confirm} onChange={setConfirm} />
            </div>
            <Button
              className="mt-6 h-12 w-full rounded-full text-base font-semibold"
              disabled={busy || current.length !== 4 || next.length !== 4 || confirm.length !== 4}
              onClick={startChange}
            >
              {busy ? "Verifying…" : "Continue"}
            </Button>
          </>
        ) : (
          <>
            <div className="mt-6 flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="mt-6 h-12 w-full rounded-full text-base font-semibold"
              disabled={busy || code.length !== 6}
              onClick={confirmChange}
            >
              {busy ? "Updating…" : "Update PIN"}
            </Button>
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={sendCode}
              className="mt-4 w-full text-center text-sm font-medium text-primary disabled:text-muted-foreground"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <InputOTP maxLength={4} value={value} onChange={onChange}>
        <InputOTPGroup>
          {[0, 1, 2, 3].map((i) => (
            <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
