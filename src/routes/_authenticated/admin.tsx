import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { NETWORKS } from "@/lib/vtu-options";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type Markup = { network: string; markup_type: string; markup_value: number };
type Plan = { id: string; network: string; category: string; name: string; wholesale_price: number; validity: string | null; is_active: boolean; sort_order: number };

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
      toast.success("Markup saved");
      qc.invalidateQueries({ queryKey: ["network_markups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <PageHeader title="Admin Console" subtitle="Data pricing & markup manager" />
      <div className="px-4 py-4">
        <Tabs defaultValue="markups">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="markups">Markups</TabsTrigger>
            <TabsTrigger value="plans">Data Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="markups" className="mt-4 space-y-3">
            {NETWORKS.map((n) => {
              const existing = markups.find((m) => m.network === n.id) ?? { network: n.id, markup_type: "flat", markup_value: 0 };
              return <MarkupRow key={n.id} name={n.name} value={existing} onSave={(m) => saveMarkup.mutate(m)} />;
            })}
          </TabsContent>

          <TabsContent value="plans" className="mt-4 space-y-3">
            <PlanCreator onCreated={() => qc.invalidateQueries({ queryKey: ["admin_data_plans"] })} />
            {plans.map((p) => (
              <PlanRow key={p.id} plan={p} onChanged={() => qc.invalidateQueries({ queryKey: ["admin_data_plans"] })} />
            ))}
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

function PlanCreator({ onCreated }: { onCreated: () => void }) {
  const [network, setNetwork] = useState("mtn");
  const [category, setCategory] = useState("daily");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [validity, setValidity] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name || !price) return toast.error("Name and wholesale price required");
    setBusy(true);
    const { error } = await supabase.from("data_plans").insert({
      network, category, name, wholesale_price: Number(price), validity, is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Plan added");
    setName(""); setPrice(""); setValidity("");
    onCreated();
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-4">
      <p className="mb-2 text-sm font-semibold">Add data plan</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={network} onChange={(e) => setNetwork(e.target.value)} className="rounded-md border border-input bg-background px-2 text-sm h-10">
          {NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-input bg-background px-2 text-sm h-10">
          <option value="daily">Daily</option>
          <option value="three_day">3-Day</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <Input placeholder="Name (e.g. 1GB)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Wholesale ₦" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <Input placeholder="Validity (e.g. 1 day)" value={validity} onChange={(e) => setValidity(e.target.value)} />
        <Button disabled={busy} onClick={create}>Add</Button>
      </div>
    </div>
  );
}

function PlanRow({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const [price, setPrice] = useState(String(plan.wholesale_price));
  async function save() {
    const { error } = await supabase.from("data_plans").update({ wholesale_price: Number(price) }).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); onChanged();
  }
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
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{plan.network.toUpperCase()} · {plan.name}</p>
          <p className="text-xs text-muted-foreground">{plan.category} · {plan.validity ?? "—"}</p>
        </div>
        <button onClick={del} aria-label="Delete" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant={plan.is_active ? "secondary" : "outline"} onClick={toggle}>
          {plan.is_active ? "Active" : "Inactive"}
        </Button>
      </div>
    </div>
  );
}
