import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { NETWORKS } from "@/lib/vtu-options";
import { Trash2, RefreshCw, KeyRound, CheckCircle2 } from "lucide-react";
import { saveOtapayKeys, syncOtapayPlans, getOtapayStatus } from "@/lib/otapay.functions";
import { savePaystackKeys, getPaystackStatus } from "@/lib/paystack.functions";

const OWNER_EMAIL = "segiruabdulfathi558@gmail.com";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    if (u.user.email !== OWNER_EMAIL) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type Markup = { network: string; markup_type: string; markup_value: number };
type Plan = { id: string; network: string; category: string; name: string; wholesale_price: number; validity: string | null; is_active: boolean };

function AdminPage() {
  const qc = useQueryClient();
  const { data: markups = [] } = useQuery({
    queryKey: ["network_markups"],
    queryFn: async () => (await supabase.from("network_markups").select("*")).data as Markup[] ?? [],
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["admin_data_plans"],
    queryFn: async () => (await supabase.from("data_plans").select("*").order("network").order("sort_order")).data as Plan[] ?? [],
  });

  const saveMarkup = useMutation({
    mutationFn: async (m: Markup) => {
      const { error } = await supabase.from("network_markups").upsert(m, { onConflict: "network" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Markup saved — applied to all live plans");
      qc.invalidateQueries({ queryKey: ["network_markups"] });
      qc.invalidateQueries({ queryKey: ["data_plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <PageHeader title="Admin Console" subtitle="Otapay sync · markup engine" />
      <div className="px-4 py-4">
        <Tabs defaultValue="markups">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="markups">Markups</TabsTrigger>
            <TabsTrigger value="plans">Data Plans</TabsTrigger>
            <TabsTrigger value="api">API Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="markups" className="mt-4 space-y-3">
            <p className="rounded-xl border border-border/50 bg-surface/50 p-3 text-xs text-muted-foreground">
              Global markup applies automatically to every live Otapay plan for that network. Retail price shown to
              users = wholesale + markup.
            </p>
            {NETWORKS.map((n) => {
              const existing = markups.find((m) => m.network === n.id) ?? { network: n.id, markup_type: "flat", markup_value: 0 };
              return <MarkupRow key={n.id} name={n.name} value={existing} onSave={(m) => saveMarkup.mutate(m)} />;
            })}
          </TabsContent>

          <TabsContent value="plans" className="mt-4 space-y-3">
            <SyncPanel onSynced={() => qc.invalidateQueries({ queryKey: ["admin_data_plans"] })} />
            {plans.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-xs text-muted-foreground">
                No plans yet. Configure Otapay API keys and run a sync.
              </p>
            )}
            {plans.map((p) => (
              <PlanRow key={p.id} plan={p} onChanged={() => qc.invalidateQueries({ queryKey: ["admin_data_plans"] })} />
            ))}
          </TabsContent>

          <TabsContent value="api" className="mt-4 space-y-3">
            <ApiSettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MarkupRow({ name, value, onSave }: { name: string; value: Markup; onSave: (m: Markup) => void }) {
  const [type, setType] = useState(value.markup_type);
  const [val, setVal] = useState(String(value.markup_value));
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="flat">Flat ₦</option>
          <option value="percent">Percent %</option>
        </select>
        <Input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ""))} />
        <Button size="sm" onClick={() => onSave({ network: value.network, markup_type: type, markup_value: Number(val || 0) })}>
          Save
        </Button>
      </div>
    </div>
  );
}

function SyncPanel({ onSynced }: { onSynced: () => void }) {
  const sync = useServerFn(syncOtapayPlans);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await sync();
      toast.success(`Synced ${res.upserted} of ${res.total} plans from Otapay`);
      onSynced();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="mb-1 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Otapay auto-sync</p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pulls live product list and wholesale prices from Otapay. Retail prices are calculated on the fly using your
        network markups — no manual editing needed.
      </p>
      <Button className="w-full" onClick={run} disabled={busy}>
        {busy ? "Syncing…" : "Fetch & Sync Plans from Otapay"}
      </Button>
    </div>
  );
}

function PlanRow({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  async function toggle() {
    const { error } = await supabase.from("data_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (error) return toast.error(error.message);
    onChanged();
  }
  async function del() {
    const { error } = await supabase.from("data_plans").delete().eq("id", plan.id);
    if (error) return toast.error(error.message);
    onChanged();
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {plan.network.toUpperCase()} · {plan.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.category} · {plan.validity ?? "—"} · Wholesale ₦{Number(plan.wholesale_price).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={plan.is_active ? "secondary" : "outline"} onClick={toggle}>
            {plan.is_active ? "Active" : "Inactive"}
          </Button>
          <button onClick={del} aria-label="Delete" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiSettingsPanel() {
  const save = useServerFn(saveOtapayKeys);
  const status = useServerFn(getOtapayStatus);
  const { data: st, refetch } = useQuery({
    queryKey: ["otapay_status"],
    queryFn: () => status(),
  });
  const [pub, setPub] = useState("");
  const [sec, setSec] = useState("");
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pub || !sec) return toast.error("Both public and secret keys are required");
    setBusy(true);
    try {
      await save({ data: { public_key: pub, secret_key: sec, base_url: base || undefined } });
      toast.success("Otapay keys saved securely");
      setPub(""); setSec("");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Otapay API credentials</p>
        </div>
        {st?.configured && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Configured · {st.public_key_masked}</span>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="pub" className="mb-1 block text-xs">Public Key</Label>
            <Input id="pub" value={pub} onChange={(e) => setPub(e.target.value)} placeholder="pk_live_..." />
          </div>
          <div>
            <Label htmlFor="sec" className="mb-1 block text-xs">Secret Key</Label>
            <Input id="sec" type="password" value={sec} onChange={(e) => setSec(e.target.value)} placeholder="sk_live_..." />
          </div>
          <div>
            <Label htmlFor="base" className="mb-1 block text-xs">Base URL (optional)</Label>
            <Input id="base" value={base} onChange={(e) => setBase(e.target.value)} placeholder={st?.base_url ?? "https://api.otapay.ng"} />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save API Keys"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Stored in a private system_settings table. Only admins can read or update these values.
          </p>
        </div>
      </div>
      <PaystackPanel />
    </div>
  );
}

function PaystackPanel() {
  const save = useServerFn(savePaystackKeys);
  const status = useServerFn(getPaystackStatus);
  const { data: st, refetch } = useQuery({
    queryKey: ["paystack_status"],
    queryFn: () => status(),
  });
  const [pub, setPub] = useState("");
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pub || !sec) return toast.error("Both Paystack keys are required");
    setBusy(true);
    try {
      await save({ data: { public_key: pub, secret_key: sec } });
      toast.success("Paystack keys saved securely");
      setPub(""); setSec("");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Paystack API credentials</p>
      </div>
      {st?.configured && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-xs text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Configured · {st.public_key_masked}</span>
        </div>
      )}
      <div className="space-y-3">
        <div>
          <Label htmlFor="pspub" className="mb-1 block text-xs">Paystack Public Key</Label>
          <Input id="pspub" value={pub} onChange={(e) => setPub(e.target.value)} placeholder="pk_live_..." />
        </div>
        <div>
          <Label htmlFor="pssec" className="mb-1 block text-xs">Paystack Secret Key</Label>
          <Input id="pssec" type="password" value={sec} onChange={(e) => setSec(e.target.value)} placeholder="sk_live_..." />
        </div>
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save Paystack Keys"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Used for wallet funding (Inline checkout), BVN validation, and dedicated virtual accounts.
          Webhook URL: <span className="font-mono text-foreground">/api/public/webhooks/paystack</span>
        </p>
      </div>
    </div>
  );
}
