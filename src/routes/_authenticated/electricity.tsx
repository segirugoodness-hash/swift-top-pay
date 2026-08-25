import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DISCOS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PinDialog } from "@/components/PinDialog";
import { spendWallet } from "@/lib/purchase";
import { useQueryClient } from "@tanstack/react-query";
import { useBalanceGuard } from "@/hooks/useBalanceGuard";

export const Route = createFileRoute("/_authenticated/electricity")({
  component: ElectricityPage,
});

// Nigerian prepaid/postpaid meter numbers are numeric, typically 10-13 digits.
const METER_REGEX = /^\d{10,13}$/;

function ElectricityPage() {
  const [disco, setDisco] = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { ensureBalance } = useBalanceGuard();

  const meterInvalid = meter.length > 0 && !METER_REGEX.test(meter);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!disco) return toast.error("Select a Disco");
    if (!METER_REGEX.test(meter)) return toast.error("Meter number must be 10–13 digits");
    const amt = parseInt(amount, 10);
    if (!amt || amt < 500) return toast.error("Minimum amount is ₦500");
    if (!ensureBalance(amt)) return;
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    const amt = parseInt(amount, 10);
    setBusy(true);
    const ok = await spendWallet({ type: "electricity", amount: amt, pin, metadata: { disco, meter, meterType } });
    setBusy(false);
    if (!ok) return;
    setPinOpen(false);
    toast.success(`₦${amt.toLocaleString()} sent to meter ${meter}`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    setAmount("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Electricity Bills" subtitle="Pay any Disco in seconds" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Disco</Label>
          <Select value={disco} onValueChange={setDisco}>
            <SelectTrigger><SelectValue placeholder="Select distribution company" /></SelectTrigger>
            <SelectContent>
              {DISCOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-2 block text-sm">Meter type</Label>
          <RadioGroup value={meterType} onValueChange={setMeterType} className="grid grid-cols-2 gap-2">
            {["prepaid", "postpaid"].map((t) => (
              <label key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm capitalize ${
                  meterType === t ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"
                }`}>
                <RadioGroupItem value={t} /> {t}
              </label>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="meter" className="mb-2 block text-sm">Meter number</Label>
          <Input id="meter" inputMode="numeric" placeholder="1234567890" value={meter}
            onChange={(e) => setMeter(e.target.value.replace(/\D/g, ""))}
            className={meterInvalid ? "border-destructive" : ""}
            maxLength={13} />
          {meterInvalid && <p className="mt-1 text-xs text-destructive">Meter number must be 10–13 digits</p>}
        </div>

        <div>
          <Label htmlFor="amount" className="mb-2 block text-sm">Amount (₦)</Label>
          <Input id="amount" inputMode="numeric" placeholder="2000" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          {amount ? `Pay ₦${Number(amount).toLocaleString()}` : "Continue"}
        </Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} amount={parseInt(amount || "0", 10)} busy={busy} onConfirm={confirm} />
    </div>
  );
}
