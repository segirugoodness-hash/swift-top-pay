import { useState } from "react";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { PinDialog } from "@/components/PinDialog";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

/** Indicative annual yield used for the "daily accrued" estimate. */
const APY = 0.1;

export function SmartVaultCard() {
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  const bal = Number(p.vault_balance ?? 0);
  const daily = (bal * APY) / 365;

  async function update(patch: { vault_roundup?: boolean; vault_roundup_step?: number }) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", p!.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function unlock(pin: string) {
    setBusy(true);
    const { error } = await supabase.rpc("vault_to_wallet", { _amount: Number(amount), _pin: pin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`₦${Number(amount).toLocaleString()} moved to your wallet`);
    setPinOpen(false); setAmount("");
    qc.invalidateQueries();
  }

  const amt = Number(amount);
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"><PiggyBank className="h-4 w-4" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Smart Vault</p>
          <p className="text-xs text-muted-foreground">Round-ups, referral rewards & cashback</p>
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-foreground">₦{bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      <p className="text-xs text-primary">+₦{daily.toFixed(2)} estimated daily yield</p>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-foreground">Round-up auto-save</p>
        <Switch checked={!!p.vault_roundup} onCheckedChange={(v) => update({ vault_roundup: v })} />
      </div>
      {p.vault_roundup && (
        <div className="mt-2 flex gap-2">
          {[100, 500].map((s) => (
            <button key={s} onClick={() => update({ vault_roundup_step: s })}
              className={`min-h-10 flex-1 rounded-full border text-xs font-semibold ${p.vault_roundup_step === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              Nearest ₦{s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Input inputMode="numeric" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="h-12 rounded-full" />
        <button
          disabled={!amt || amt > bal}
          onClick={() => setPinOpen(true)}
          className="min-h-12 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Unlock & Transfer to Wallet
        </button>
      </div>
      <PinDialog open={pinOpen} onOpenChange={setPinOpen} amount={amt} title="Unlock vault savings" busy={busy} onConfirm={unlock} />
    </div>
  );
}
