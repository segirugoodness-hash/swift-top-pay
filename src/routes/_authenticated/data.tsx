import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { NETWORKS } from "@/lib/vtu-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PinDialog } from "@/components/PinDialog";
import { spendWallet } from "@/lib/purchase";
import { applyMarkup, type MarkupRow } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/data")({
  component: DataPage,
});

type DBPlan = { id: string; network: string; category: string; name: string; wholesale_price: number; validity: string | null; is_active: boolean; external_id?: string | null };
type RetailPlan = { id: string; name: string; validity: string | null; price: number; wholesale: number; external_id: string | null };

const CATEGORIES = [
  { key: "sme", label: "SME 30-Day", badge: "VALUE" },
  { key: "daily", label: "Daily" },
  { key: "three_day", label: "3-Day" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

const SME_KEYWORDS = /(sme|corporate|gifting|30\s*day)/i;

function DataPage() {
  const [network, setNetwork] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<RetailPlan | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ["data_plans"],
    queryFn: async () =>
      ((await supabase.from("data_plans").select("*").eq("is_active", true).order("sort_order")).data as DBPlan[]) ?? [],
    staleTime: 30_000,
  });
  const { data: markups = [] } = useQuery({
    queryKey: ["network_markups"],
    queryFn: async () => ((await supabase.from("network_markups").select("*")).data as MarkupRow[]) ?? [],
    staleTime: 60_000,
  });

  const priced = useMemo(() => {
    const m = markups.find((x) => x.network === network);
    const grouped: Record<string, RetailPlan[]> = { sme: [], daily: [], three_day: [], weekly: [], monthly: [] };
    for (const p of plans.filter((p) => p.network === network)) {
      const wholesale = Number(p.wholesale_price);
      const price = applyMarkup(wholesale, m);
      const row = { id: p.id, name: p.name, validity: p.validity, price, wholesale, external_id: p.external_id ?? null };
      grouped[p.category]?.push(row);
      // SME/Corporate/30-day plans are also surfaced in the highlighted "Value" tab.
      const is30Day = /30\s*day/i.test(p.validity ?? "") || p.category === "monthly";
      if (is30Day && SME_KEYWORDS.test(p.name)) grouped.sme.push(row);
    }
    return grouped;
  }, [plans, markups, network]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 11) return toast.error("Enter a valid 11-digit phone number");
    if (!plan) return toast.error("Select a data plan");
    setPinOpen(true);
  }

  async function confirm(pin: string) {
    if (!plan) return;
    setBusy(true);
    const ok = await spendWallet({
      type: "data",
      retail: plan.price,
      wholesale: plan.wholesale,
      pin,
      metadata: { network, phone, plan: plan.name, plan_id: plan.id },
      otapayPayload: { network, phone, plan_id: plan.external_id ?? plan.id },
    });
    setBusy(false);
    if (!ok) return;
    setPinOpen(false);
    toast.success(`${plan.name} sent to ${phone}`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["transactions", "recent"] });
    setPlan(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Buy Data" subtitle="Live pricing · updated by admin" />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <Label className="mb-2 block text-sm">Select network</Label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button key={n.id} type="button" onClick={() => { setNetwork(n.id); setPlan(null); }}
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
          <Label htmlFor="phone" className="mb-2 block text-sm">Phone number</Label>
          <Input id="phone" inputMode="numeric" maxLength={11} placeholder="08012345678"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </div>

        <div>
          <Label className="mb-2 block text-sm">Choose a plan</Label>
          <Tabs defaultValue="sme">
            <TabsList className="grid w-full grid-cols-5">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.key} value={c.key} className="text-[11px]">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((c) => (
              <TabsContent key={c.key} value={c.key} className="mt-3 space-y-2">
                {c.key === "sme" && (
                  <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-3">
                    <p className="text-xs font-bold text-primary">SME / 30-Day Value Plans</p>
                    <p className="text-[11px] text-muted-foreground">
                      30× more validity than a 1-day plan from your bank app. Same MB. Way cheaper per GB.
                    </p>
                  </div>
                )}
                {priced[c.key].length === 0 && (
                  <p className="rounded-xl border border-dashed border-border bg-surface/50 p-4 text-center text-xs text-muted-foreground">
                    No plans available yet.
                  </p>
                )}
                {priced[c.key].map((p) => {
                  const is30 = /30\s*day/i.test(p.validity ?? "");
                  return (
                    <button key={p.id} type="button" onClick={() => setPlan(p)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        plan?.id === p.id ? "border-primary bg-primary/10" : "border-border bg-surface"
                      }`}>
                      <span>
                        <span className="block text-sm font-medium text-foreground">{p.name}</span>
                        {p.validity && (
                          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            is30 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            {p.validity} Validity
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-primary">₦{p.price.toLocaleString()}</span>
                    </button>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Button type="submit" className="mt-auto h-12 rounded-full text-base font-semibold">
          {plan ? `Pay ₦${plan.price.toLocaleString()}` : "Continue"}
        </Button>
      </form>

      <PinDialog open={pinOpen} onOpenChange={setPinOpen} amount={plan?.price ?? 0} busy={busy} onConfirm={confirm} />
    </div>
  );
}
