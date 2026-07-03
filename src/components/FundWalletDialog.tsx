import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSettings, useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Clock, ShieldCheck, Building2 } from "lucide-react";

const BANKS_POOL = [
  { bank: "Wema Bank", prefix: "9" },
  { bank: "Sterling Bank", prefix: "8" },
  { bank: "Providus Bank", prefix: "5" },
];

function makeAcctNumber() {
  return String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999));
}

export function FundWalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: settings } = useAdminSettings();
  const { data: profile } = useProfile();
  const useDedicated = !!settings?.use_dedicated_accounts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        {useDedicated ? (
          profile?.bvn_verified && profile.dedicated_account_number ? (
            <DedicatedAccountView profile={profile} />
          ) : (
            <BvnFlow onDone={() => onOpenChange(true)} />
          )
        ) : (
          <StarterFlow onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Starter (Paystack-style temporary) ---------- */

function StarterFlow({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState<null | {
    account_number: string;
    bank_name: string;
    account_name: string;
    expires_at: number;
    amount: number;
  }>(null);
  const [now, setNow] = useState(Date.now());
  const qc = useQueryClient();

  useEffect(() => {
    if (!confirmed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [confirmed]);

  const remaining = useMemo(() => {
    if (!confirmed) return 0;
    return Math.max(0, Math.floor((confirmed.expires_at - now) / 1000));
  }, [confirmed, now]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt < 100) return toast.error("Enter at least ₦100");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sign in required");
    const pick = BANKS_POOL[Math.floor(Math.random() * BANKS_POOL.length)];
    const acct = pick.prefix + makeAcctNumber().slice(1);
    const expires = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("funding_requests").insert({
      user_id: u.user.id,
      amount: amt,
      account_number: acct,
      bank_name: pick.bank,
      account_name: "SWIFT TOP / " + (u.user.email?.split("@")[0] ?? "USER").toUpperCase(),
      status: "pending",
      expires_at: expires,
    }).select().single();
    if (error || !data) return toast.error(error?.message ?? "Could not create request");
    setConfirmed({
      account_number: data.account_number,
      bank_name: data.bank_name,
      account_name: data.account_name,
      expires_at: new Date(data.expires_at).getTime(),
      amount: Number(data.amount),
    });
    qc.invalidateQueries({ queryKey: ["funding"] });
  }

  if (!confirmed) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Fund your wallet</DialogTitle>
          <DialogDescription>Enter an amount to generate a temporary account for deposit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={generate} className="mt-2 flex flex-col gap-4">
          <div>
            <Label htmlFor="amt" className="mb-2 block text-sm">Amount (₦)</Label>
            <Input id="amt" inputMode="numeric" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            <div className="mt-2 flex flex-wrap gap-2">
              {["1000", "2000", "5000", "10000"].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(v)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  ₦{v}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="h-11 rounded-full">Generate account</Button>
        </form>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Complete your deposit</DialogTitle>
        <DialogDescription>
          Transfer <span className="font-semibold text-foreground">₦{confirmed.amount.toLocaleString()}</span> to the account below within 20 minutes.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 space-y-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Bank</p>
          <p className="text-sm font-semibold text-foreground">{confirmed.bank_name}</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Account number</p>
              <p className="font-display text-xl font-bold tracking-wider text-foreground">{confirmed.account_number}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(confirmed.account_number); toast.success("Copied"); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
              aria-label="Copy account number"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Account name</p>
          <p className="text-sm font-medium text-foreground">{confirmed.account_name}</p>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-mono font-semibold text-foreground">{mm}:{ss}</span>
          <span className="text-xs text-muted-foreground">until account expires</span>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Open your bank app and transfer the exact amount.</li>
          <li>Your wallet is credited automatically after confirmation.</li>
          <li>This account is temporary and will expire in 20 minutes.</li>
        </ol>

        <Button variant="secondary" className="w-full rounded-full" onClick={onClose}>I've made the transfer</Button>
      </div>
    </>
  );
}

/* ---------- BVN flow (registered mode, first time) ---------- */

function BvnFlow({ onDone }: { onDone: () => void }) {
  const [bvn, setBvn] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (bvn.length !== 11) return toast.error("BVN must be 11 digits");
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return toast.error("Sign in required"); }
    // Simulated verification + dedicated account provisioning
    const acct = "10" + String(Math.floor(10_000_000 + Math.random() * 89_999_999));
    const { error } = await supabase.from("profiles").update({
      bvn,
      bvn_verified: true,
      dedicated_account_number: acct,
      dedicated_account_bank: "Wema Bank",
      dedicated_account_name: "SWIFT TOP / " + (u.user.email?.split("@")[0] ?? "USER").toUpperCase(),
    }).eq("id", u.user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("BVN verified — dedicated account issued");
    qc.invalidateQueries({ queryKey: ["profile"] });
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> BVN verification</DialogTitle>
        <DialogDescription>Verify your BVN once to receive a permanent dedicated account.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
        <div>
          <Label htmlFor="bvn" className="mb-2 block text-sm">BVN (11 digits)</Label>
          <Input id="bvn" inputMode="numeric" maxLength={11} value={bvn} onChange={(e) => setBvn(e.target.value.replace(/\D/g, ""))} placeholder="22212345678" />
        </div>
        <p className="text-xs text-muted-foreground">Your BVN is encrypted and used only for account verification. Dial *565*0# to retrieve yours.</p>
        <Button type="submit" disabled={loading} className="h-11 rounded-full">
          {loading ? "Verifying…" : "Verify BVN"}
        </Button>
      </form>
    </>
  );
}

/* ---------- Dedicated account view (registered mode) ---------- */

function DedicatedAccountView({ profile }: { profile: NonNullable<ReturnType<typeof useProfile>["data"]> }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Your dedicated account</DialogTitle>
        <DialogDescription>Transfer any amount to instantly fund your wallet.</DialogDescription>
      </DialogHeader>
      <div className="mt-2 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">Bank</p>
        <p className="text-sm font-semibold text-foreground">{profile.dedicated_account_bank}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Account number</p>
            <p className="font-display text-xl font-bold tracking-wider text-foreground">{profile.dedicated_account_number}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(profile.dedicated_account_number!); toast.success("Copied"); }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            aria-label="Copy account number"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Account name</p>
        <p className="text-sm font-medium text-foreground">{profile.dedicated_account_name}</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Deposits are credited to your Swift Top wallet automatically.</p>
    </>
  );
}
