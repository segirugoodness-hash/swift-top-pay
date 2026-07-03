import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { spendWallet } from "@/lib/purchase";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/data")({
  component: DataPage,
});

type Plan = { name: string; price: number };
const PLANS: Record<"daily" | "three_day" | "weekly" | "monthly", Plan[]> = {
  daily: [
    { name: "100MB — 1 day", price: 100 },
    { name: "1GB — 1 day", price: 350 },
  ],
  three_day: [
    { name: "200MB — 3 days", price: 200 },
    { name: "2.5GB — 3 days", price: 600 },
  ],
  weekly: [
    { name: "750MB — 7 days", price: 500 },
    { name: "2GB — 7 days", price: 1200 },
  ],
  monthly: [
    { name: "4.1GB — 30 days", price: 1500 },
    { name: "12GB — 30 days", price: 3500 },
  ],
};

function DataPage() {
  const [network, setNetwork] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    if (!plan) return toast.error("Select a data plan");
    setBusy(true);
    const ok = await spendWallet({ type: "data", amount: plan.price, metadata: { network, phone, plan: plan.name } });
    setBusy(false);
    if (!ok) return;
    toast.success(`${plan.name} sent to ${phone}`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    setPlan(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Buy Data" subtitle="Daily, 3-day, weekly & monthly bundles" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Select network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-xs font-semibold ${
                  network === n.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span className="mb-1 h-3 w-3 rounded-full" style={{ backgroundColor: n.color }} />
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
          <Label className="mb-2 block text-sm">Choose a plan</Label>
          <Tabs defaultValue="daily">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="three_day">3-Day</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            {(["daily", "three_day", "weekly", "monthly"] as const).map((k) => (
              <TabsContent key={k} value={k} className="mt-3 space-y-2">
                {PLANS[k].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      plan?.name === p.name ? "border-primary bg-primary/10" : "border-border bg-surface"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-sm font-semibold text-primary">₦{p.price.toLocaleString()}</span>
                  </button>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Button type="submit" disabled={busy} className="mt-auto h-12 rounded-full text-base font-semibold">
          {busy ? "Processing…" : plan ? `Pay ₦${plan.price.toLocaleString()}` : "Continue"}
        </Button>
      </form>
    </div>
  );
}
