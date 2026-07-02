import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/data")({
  component: DataPage,
});

const PLANS = {
  daily: [
    { name: "40MB — 1 day", price: "₦50" },
    { name: "100MB — 1 day", price: "₦100" },
    { name: "1GB — 1 day", price: "₦350" },
  ],
  weekly: [
    { name: "750MB — 7 days", price: "₦500" },
    { name: "1.5GB — 7 days", price: "₦1,000" },
    { name: "6GB — 7 days", price: "₦2,500" },
  ],
  monthly: [
    { name: "1.5GB — 30 days", price: "₦1,000" },
    { name: "4.5GB — 30 days", price: "₦2,000" },
    { name: "15GB — 30 days", price: "₦5,000" },
    { name: "40GB — 30 days", price: "₦10,000" },
  ],
};

function DataPage() {
  const [network, setNetwork] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    if (!plan) return toast.error("Select a data plan");
    toast.success(`${plan} queued for ${phone}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Buy Data" subtitle="Daily, weekly & monthly bundles" />
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
          <Label className="mb-2 block text-sm">Choose a plan</Label>
          <Tabs defaultValue="daily">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            {(["daily", "weekly", "monthly"] as const).map((k) => (
              <TabsContent key={k} value={k} className="mt-3 space-y-2">
                {PLANS[k].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPlan(p.name)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      plan === p.name
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-sm font-semibold text-primary">{p.price}</span>
                  </button>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          Continue
        </Button>
      </form>
    </div>
  );
}
