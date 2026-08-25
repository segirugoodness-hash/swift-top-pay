import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PinDialog } from "@/components/PinDialog";
import { spendWallet } from "@/lib/purchase";
import { useQueryClient } from "@tanstack/react-query";
import { useBalanceGuard } from "@/hooks/useBalanceGuard";
import { airtimeQuote } from "@/lib/airtime-pricing";

export const Route = createFileRoute("/_authenticated/airtime")({
  component: AirtimePage,
});

function AirtimePage() {
  const [network, setNetwork] = useState<string>("mtn");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { ensureBalance } = useBalanceGuard();

  const face = parseInt(amount, 10) || 0;
  const quote = face > 0 ? airtimeQuote(network, face) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    if (!face || face < 50) return toast.error("Minimum airtime is ₦50");
    if (!ensureBalance(quote?.retail ?? face)) return;
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    if (!quote) return;
    setBusy(true);
    const ok = await spendWallet({
      type: "airtime",
      retail: quote.retail,
      wholesale: quote.wholesale,
      pin,
      metadata: { network, phone, face_amount: face, cashback: quote.cashback },
      otapayPayload: { network, phone, amount: face },
    });
    setBusy(false);
    if (!ok) return;
    setPinOpen(false);
    toast.success(`₦${face.toLocaleString()} airtime sent to ${phone}${quote.cashback ? ` · You saved ₦${quote.cashback}` : ""}`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    setAmount("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Buy Airtime" subtitle="Instant top-up · instant cashback" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Select network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button key={n.id} type="button" onClick={() => setNetwork(n.id)}
                className={`flex h-16 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition ${
                  network === n.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground"
                }`}>
                <span className="mb-1 h-4 w-4 rounded-full" style={{ backgroundColor: n.color }} />
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="phone" className="mb-2 block text-sm">Phone number</Label>
          <Input id="phone" inputMode="numeric" maxLength={11} placeholder="08012345678"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </div>

        <div>
          <Label htmlFor="amount" className="mb-2 block text-sm">Amount (₦)</Label>
          <Input id="amount" inputMode="numeric" placeholder="500"
            value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          <div className="mt-2 flex flex-wrap gap-2">
            {["100", "200", "500", "1000", "2000"].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                ₦{v}
              </button>
            ))}
          </div>
          {quote && quote.cashback > 0 && (
            <div className="mt-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wide">Instant cashback</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                Buy ₦{face.toLocaleString()} airtime for only ₦{quote.retail.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                You save ₦{quote.cashback.toLocaleString()} ({quote.userDiscountPct.toFixed(0)}% off) · credited automatically.
              </p>
            </div>
          )}
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          {quote ? `Pay ₦${quote.retail.toLocaleString()}` : "Continue"}
        </Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} amount={quote?.retail ?? 0} busy={busy} onConfirm={confirm} />
    </div>
  );
}
