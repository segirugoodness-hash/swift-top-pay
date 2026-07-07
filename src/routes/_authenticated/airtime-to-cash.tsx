import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitA2C } from "@/lib/a2c.functions";
import { Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/airtime-to-cash")({
  component: AirtimeToCashPage,
});

const PAYOUT_RATE = 0.8;

function AirtimeToCashPage() {
  const submit = useServerFn(submitA2C);
  const qc = useQueryClient();
  const [network, setNetwork] = useState("mtn");
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ recipient_phone: string | null; instructions: string; expected_payout: number; reference: string } | null>(null);

  const airtime = Number(amount) || 0;
  const payout = Math.floor(airtime * PAYOUT_RATE);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sender.length !== 11) return toast.error("Enter a valid 11-digit sender phone");
    if (airtime < 100) return toast.error("Minimum airtime is ₦100");
    setBusy(true);
    try {
      const r = await submit({ data: { network, sender_phone: sender, airtime_amount: airtime } });
      setResult(r);
      toast.success(`Request submitted · You'll receive ₦${r.expected_payout.toLocaleString()}`);
      qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Airtime to Cash" subtitle="80% instant payout · powered by Otapay" />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button key={n.id} type="button" onClick={() => setNetwork(n.id)}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-xs font-semibold ${
                  network === n.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground"
                }`}>
                <span className="mb-1 h-3 w-3 rounded-full" style={{ backgroundColor: n.color }} />
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="sender" className="mb-2 block text-sm">Sender phone number</Label>
          <Input id="sender" inputMode="numeric" maxLength={11} placeholder="08012345678"
            value={sender} onChange={(e) => setSender(e.target.value.replace(/\D/g, ""))} />
        </div>

        <div>
          <Label htmlFor="amt" className="mb-2 block text-sm">Airtime amount (₦)</Label>
          <Input id="amt" inputMode="numeric" placeholder="1000"
            value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          {airtime > 0 && (
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">You will receive</p>
              <p className="text-lg font-bold text-primary">₦{payout.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">80% instant wallet credit on confirmed transfer</p>
            </div>
          )}
        </div>

        {result && (
          <div className="rounded-xl border border-border bg-surface p-3 text-xs">
            <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-primary" /> Instructions
            </div>
            <p className="text-muted-foreground">{result.instructions}</p>
            {result.recipient_phone && (
              <p className="mt-2">
                Transfer to: <span className="font-mono text-foreground">{result.recipient_phone}</span>
              </p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">Ref: {result.reference}</p>
          </div>
        )}

        <Button type="submit" disabled={busy} className="mt-auto h-12 rounded-full text-base font-semibold">
          {busy ? "Submitting…" : `Request ₦${payout.toLocaleString()} payout`}
        </Button>
      </form>
    </div>
  );
}
