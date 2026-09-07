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
import { Trash2, RefreshCw, KeyRound, CheckCircle2, Wallet, ArrowUpRight, Users, Search, TrendingUp, ShieldCheck } from "lucide-react";
import { listUsers, adminAdjustWallet, getProfitSummary, type AdminUserRow } from "@/lib/admin.functions";
import { saveOtapayKeys, syncOtapayPlans, getOtapayStatus } from "@/lib/otapay.functions";
import { savePaystackKeys, getPaystackStatus } from "@/lib/paystack.functions";
import { getAdminEarnings } from "@/lib/vend.functions";
import { AdminPayoutDialog } from "@/components/AdminPayoutDialog";

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
      <PageHeader title="Super Admin Console" subtitle="Users · profits · Otapay sync · markups" />
      <div className="px-4 py-4 space-y-4">
        <EarningsPanel />
        <ProfitPanel />
        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="markups">Markups</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4 space-y-3">
            <UsersPanel />
          </TabsContent>

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

function EarningsPanel() {
  const earningsFn = useServerFn(getAdminEarnings);
  const { data, refetch } = useQuery({
    queryKey: ["admin_earnings"],
    queryFn: () => earningsFn(),
  });
  const [payoutOpen, setPayoutOpen] = useState(false);
  const balance = Number(data?.balance ?? 0);
  const lifetime = Number(data?.lifetime_revenue ?? 0);
  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Platform revenue</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</p>
          <p className="text-xl font-bold text-primary">₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lifetime</p>
          <p className="text-xl font-bold text-foreground">₦{lifetime.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
      <Button
        onClick={() => setPayoutOpen(true)}
        disabled={balance < 500}
        className="mt-3 h-11 w-full rounded-full text-sm font-semibold"
      >
        <ArrowUpRight className="mr-2 h-4 w-4" /> Withdraw profits
      </Button>
      <AdminPayoutDialog open={payoutOpen} onOpenChange={setPayoutOpen} balance={balance} onSuccess={() => refetch()} />
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
      if (res.maintenance) {
        toast.message(res.message ?? "Otapay under brief maintenance. Local wholesale benchmarks loaded.");
      } else {
        toast.success(`Synced ${res.upserted} of ${res.total} plans from Otapay`);
      }
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


/* ---------------- Profit ledger ---------------- */

function ProfitPanel() {
  const summaryFn = useServerFn(getProfitSummary);
  const { data } = useQuery({ queryKey: ["admin_profits"], queryFn: () => summaryFn() });
  const money = (n: number) => `₦${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Profit ledger</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Today" value={money(data?.today ?? 0)} />
        <Stat label="This month" value={money(data?.month ?? 0)} />
        <Stat label="Lifetime" value={money(data?.lifetime ?? 0)} />
      </div>

      {(data?.byService.length ?? 0) > 0 && (
        <div className="mt-3 space-y-1.5">
          {data!.byService.map((s) => (
            <div key={s.service} className="flex items-center justify-between text-xs">
              <span className="capitalize text-muted-foreground">
                {s.service.replace(/_/g, " ")} · {s.count}
              </span>
              <span className="font-semibold text-primary">{money(s.margin)}</span>
            </div>
          ))}
        </div>
      )}

      {(data?.recent.length ?? 0) > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Latest entries</p>
          <div className="space-y-1.5">
            {data!.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · <span className="capitalize">{r.service.replace(/_/g, " ")}</span>
                </span>
                <span className="ml-2 shrink-0 font-medium text-foreground">
                  {money(r.charged)} − {money(r.cost)} = <span className="text-primary">{money(r.margin)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.recent.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No sales logged yet — margins appear here the moment a purchase completes.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ---------------- User management ---------------- */

function UsersPanel() {
  const list = useServerFn(listUsers);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  const { data: users = [], isFetching, refetch } = useQuery({
    queryKey: ["admin_users", term, pendingOnly],
    queryFn: () => list({ data: { search: term, pendingOnly } }),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setTerm(search); }}
            placeholder="Name, phone or email"
            className="pl-9"
          />
        </div>
        <Button onClick={() => setTerm(search)} disabled={isFetching}>Search</Button>
      </div>

      <button
        type="button"
        onClick={() => setPendingOnly((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-xl border p-3 text-xs ${
          pendingOnly ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"
        }`}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {pendingOnly ? "Showing BVN submissions awaiting a virtual account" : "Show only pending BVN verifications"}
      </button>

      {users.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-xs text-muted-foreground">
          {isFetching ? "Loading users…" : "No users match that search."}
        </p>
      )}

      {users.map((u) => (
        <div key={u.id} className="rounded-2xl border border-border bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{u.full_name ?? "Unnamed user"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.phone ?? "—"} · {u.email ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold text-primary">
                  ₦{u.wallet_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                {" · "}{u.account_tier}
                {u.bvn_submitted && !u.dedicated_account_number ? " · BVN pending" : ""}
                {u.dedicated_account_number ? ` · ${u.dedicated_account_number}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelected(u)}>
              <Users className="mr-1.5 h-3.5 w-3.5" /> Wallet
            </Button>
          </div>
        </div>
      ))}

      <AdjustWalletDialog user={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); refetch(); }} />
    </div>
  );
}

function AdjustWalletDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const adjust = useServerFn(adminAdjustWallet);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(direction: 1 | -1) {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    if (reason.trim().length < 3) return toast.error("Add a short reason");
    setBusy(true);
    try {
      const r = await adjust({ data: { userId: user!.id, amount: amt * direction, reason: reason.trim() } });
      toast.success(`Wallet updated — new balance ₦${r.balance.toLocaleString()}`);
      setAmount(""); setReason("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-foreground">Adjust wallet</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {user.full_name ?? user.phone ?? user.id.slice(0, 8)} · current ₦{user.wallet_balance.toLocaleString()}
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="adj-amt" className="mb-1 block text-xs">Amount (₦)</Label>
            <Input id="adj-amt" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="5000" />
          </div>
          <div>
            <Label htmlFor="adj-reason" className="mb-1 block text-xs">Reason (recorded in history)</Label>
            <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Manual bank transfer received" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => { run(1).catch(() => undefined); }}>
              Credit
            </Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => { run(-1).catch(() => undefined); }}>
              Debit
            </Button>
          </div>
          <button type="button" onClick={onClose} className="w-full py-1 text-xs text-muted-foreground">Close</button>
        </div>
      </div>
    </div>
  );
}
