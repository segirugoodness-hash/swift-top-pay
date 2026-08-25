import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CABLE_PROVIDERS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PinDialog } from "@/components/PinDialog";
import { spendWallet } from "@/lib/purchase";
import { useQueryClient } from "@tanstack/react-query";
import { useBalanceGuard } from "@/hooks/useBalanceGuard";

export const Route = createFileRoute("/_authenticated/cable")({
  component: CablePage,
});

function priceOf(pkg: string): number {
  const m = pkg.match(/₦([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

function CablePage() {
  const [providerId, setProviderId] = useState<string>("dstv");
  const [smartcard, setSmartcard] = useState("");
  const [pkg, setPkg] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { ensureBalance } = useBalanceGuard();
  const provider = CABLE_PROVIDERS.find((p) => p.id === providerId)!;
  const amt = priceOf(pkg);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (smartcard.length < 10) return toast.error("Enter a valid smartcard number");
    if (!pkg) return toast.error("Select a package");
    if (!ensureBalance(amt)) return;
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    setBusy(true);
    const ok = await spendWallet({ type: "cable", amount: amt, pin, metadata: { provider: provider.name, smartcard, package: pkg } });
    setBusy(false);
    if (!ok) return;
    setPinOpen(false);
    toast.success(`${provider.name} — ${pkg} activated`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Cable TV Subscription" subtitle="DSTV, GOTV & StarTimes" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Provider</Label>
          <div className="grid grid-cols-3 gap-2">
            {CABLE_PROVIDERS.map((p) => (
              <button key={p.id} type="button" onClick={() => { setProviderId(p.id); setPkg(""); }}
                className={`h-14 rounded-xl border text-sm font-semibold ${
                  providerId === p.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground"
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="sc" className="mb-2 block text-sm">Smartcard / IUC number</Label>
          <Input id="sc" inputMode="numeric" placeholder="1234567890" value={smartcard}
            onChange={(e) => setSmartcard(e.target.value.replace(/\D/g, ""))} />
        </div>

        <div>
          <Label className="mb-2 block text-sm">Package</Label>
          <Select value={pkg} onValueChange={setPkg}>
            <SelectTrigger><SelectValue placeholder={`Select ${provider.name} package`} /></SelectTrigger>
            <SelectContent>
              {provider.packages.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          {pkg ? `Pay ₦${amt.toLocaleString()}` : "Continue"}
        </Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} amount={amt} busy={busy} onConfirm={confirm} />
    </div>
  );
}
