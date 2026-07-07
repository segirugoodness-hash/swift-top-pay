import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ChangePinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() { setCurrent(""); setNext(""); setConfirm(""); }

  async function submit() {
    if (current.length !== 4) return toast.error("Enter your current 4-digit PIN");
    if (next.length !== 4) return toast.error("New PIN must be 4 digits");
    if (next !== confirm) return toast.error("New PINs do not match");
    if (next === current) return toast.error("New PIN must be different from current");
    setBusy(true);
    const { error } = await supabase.rpc("change_transaction_pin", { _current: current, _new: next });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transaction PIN updated");
    reset();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-background pb-8 pt-6">
        <SheetHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <SheetTitle className="font-display">Change transaction PIN</SheetTitle>
          <SheetDescription>Verify your current PIN, then choose a new one.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <Field label="Current PIN" value={current} onChange={setCurrent} />
          <Field label="New PIN" value={next} onChange={setNext} />
          <Field label="Confirm new PIN" value={confirm} onChange={setConfirm} />
        </div>
        <Button
          className="mt-6 h-12 w-full rounded-full text-base font-semibold"
          disabled={busy || current.length !== 4 || next.length !== 4 || confirm.length !== 4}
          onClick={submit}
        >
          {busy ? "Updating…" : "Update PIN"}
        </Button>
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
