import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { spendWallet } from "@/lib/purchase";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/airtime")({
  component: AirtimePage,
});

function AirtimePage() {
  const [network, setNetwork] = useState<string>("mtn");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    const amt = parseInt(amount, 10);
    if (!amt || amt < 50) return toast.error("Minimum airtime is ₦50");
    setBusy(true);
    const ok = await spendWallet({ type: "airtime", amount: amt, metadata: { network, phone } });
    setBusy(false);
    if (!ok) return;
    toast.success(`₦${amt} airtime sent to ${phone}`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    setAmount("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Buy Airtime" subtitle="Instant top-up for all networks" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Select network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={`flex h-16 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition ${
                  network === n.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span
                  className="mb-1 h-4 w-4 rounded-full"
                  style={{ backgroundColor: n.color }}
                />
                {n.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="phone" className="mb-2 block text-sm">
            Phone number
          </Label>
          <Input
            id="phone"
            inputMode="numeric"
            maxLength={11}
            placeholder="08012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div>
          <Label htmlFor="amount" className="mb-2 block text-sm">
            Amount (₦)
          </Label>
          <Input
            id="amount"
            inputMode="numeric"
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {["100", "200", "500", "1000", "2000"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                ₦{v}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={busy} className="mt-auto h-12 rounded-full text-base font-semibold">
          {busy ? "Processing…" : amount ? `Pay ₦${Number(amount).toLocaleString()}` : "Continue"}
        </Button>
      </form>
    </div>
  );
}
