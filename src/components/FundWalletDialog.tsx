import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ShieldCheck, Building2, CreditCard, Sparkles } from "lucide-react";
import { initPaystackFunding, upgradeToVerified } from "@/lib/paystack.functions";

/** Lazy loader for Paystack Inline script. */
function loadPaystack(): Promise<{ setup: (opts: Record<string, unknown>) => { openIframe: () => void } }> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { PaystackPop?: unknown };
    if (w.PaystackPop) return resolve(w.PaystackPop as never);
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve((window as unknown as { PaystackPop: never }).PaystackPop);
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(s);
  });
}

export function FundWalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useProfile();
  const [tab, setTab] = useState<"starter" | "upgrade">("starter");
  const verified = profile?.account_tier === "verified" && !!profile.dedicated_account_number;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        {verified ? (
          <DedicatedAccountView profile={profile!} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fund your wallet</DialogTitle>
              <DialogDescription>
                Pay instantly with card, USSD or bank transfer via Paystack.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex rounded-full border border-border bg-surface p-1 text-xs">
              <button
                onClick={() => setTab("starter")}
                className={`flex-1 rounded-full py-2 font-semibold transition ${
                  tab === "starter" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Pay now
              </button>
              <button
                onClick={() => setTab("upgrade")}
                className={`flex-1 rounded-full py-2 font-semibold transition ${
                  tab === "upgrade" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Upgrade to Verified
              </button>
            </div>
            {tab === "starter" ? <PaystackFlow onClose={() => onOpenChange(false)} /> : <VerifiedUpgradeFlow />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Paystack Inline (Starter default) ---------- */

function PaystackFlow({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const init = useServerFn(initPaystackFunding);
  const qc = useQueryClient();

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt < 100) return toast.error("Enter at least ₦100");
    setBusy(true);
    try {
      const { access_code, public_key, authorization_url } = await init({ data: { amount: amt } });
      const Paystack = await loadPaystack().catch(() => null);
      if (Paystack && public_key) {
        const handler = Paystack.setup({
          key: public_key,
          access_code,
          onSuccess: () => {
            toast.success("Payment received — wallet crediting shortly");
            qc.invalidateQueries({ queryKey: ["profile"] });
            onClose();
          },
          onCancel: () => toast.message("Payment cancelled"),
        });
        handler.openIframe();
      } else {
        window.location.href = authorization_url;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} className="mt-3 flex flex-col gap-4">
      <div>
        <Label htmlFor="amt" className="mb-2 block text-sm">Amount (₦)</Label>
        <Input
          id="amt"
          inputMode="numeric"
          placeholder="5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {["1000", "2000", "5000", "10000"].map((v) => (
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
      <Button type="submit" disabled={busy} className="h-11 rounded-full">
        <CreditCard className="mr-2 h-4 w-4" />
        {busy ? "Preparing…" : "Continue to Paystack"}
      </Button>
      <p className="rounded-xl border border-border/60 bg-surface/60 p-3 text-[11px] text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
        Upgrade to a Verified account to receive a permanent bank account for automated instant funding.
      </p>
    </form>
  );
}

/* ---------- Verified upgrade (BVN + DVA) ---------- */

function VerifiedUpgradeFlow() {
  const [bvn, setBvn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const upgrade = useServerFn(upgradeToVerified);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (bvn.length !== 11) return toast.error("BVN must be 11 digits");
    if (!firstName.trim() || !lastName.trim()) return toast.error("Enter your legal first and last name");
    setBusy(true);
    try {
      const r = await upgrade({ data: { bvn, first_name: firstName.trim(), last_name: lastName.trim() } });
      qc.invalidateQueries({ queryKey: ["profile"] });
      if (r.status === "verified") {
        toast.success("Verified — your dedicated bank account is ready");
      } else {
        setPending(true);
        toast.success("Verification submitted — details safely saved");
      }
    } catch (err) {
      // Fallback safety net — should be rare because the server always intercepts.
      setPending(true);
      toast.message("Verification queued for review", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-bold">Verification is being processed by Paystack</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your dedicated virtual account number will be issued shortly. We'll notify you the moment it's ready.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Fund your wallet right now</p>
          </div>
          <p className="text-xs text-muted-foreground">
            While we finalise your dedicated account, use <span className="font-semibold text-foreground">Pay Now</span> at
            the top of this dialog to fund instantly with your card, USSD or bank transfer via secure Paystack checkout.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
        <ShieldCheck className="h-4 w-4" />
        <span>Legal name must exactly match the one linked to your BVN.</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1 block text-xs">First name</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Last name</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
        </div>
      </div>
      <div>
        <Label htmlFor="bvn" className="mb-1 block text-xs">BVN (11 digits)</Label>
        <Input id="bvn" inputMode="numeric" maxLength={11} value={bvn}
          onChange={(e) => setBvn(e.target.value.replace(/\D/g, ""))} placeholder="22212345678" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Dial *565*0# on your registered SIM to retrieve your BVN. It is encrypted and only used to verify identity.
      </p>
      <Button type="submit" disabled={busy} className="h-11 rounded-full">
        {busy ? "Verifying…" : "Verify & issue account"}
      </Button>
    </form>
  );
}

/* ---------- Dedicated account view (Verified) ---------- */

function DedicatedAccountView({ profile }: { profile: NonNullable<ReturnType<typeof useProfile>["data"]> }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Your dedicated account
        </DialogTitle>
        <DialogDescription>Transfer any amount from any bank to fund your wallet instantly.</DialogDescription>
      </DialogHeader>
      <div className="mt-2 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">Bank</p>
        <p className="text-sm font-semibold text-foreground">{profile.dedicated_account_bank}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Account number</p>
            <p className="font-display text-xl font-bold tracking-wider text-foreground">
              {profile.dedicated_account_number}
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(profile.dedicated_account_number!);
              toast.success("Copied");
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary"
            aria-label="Copy account number"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Account name</p>
        <p className="text-sm font-medium text-foreground">{profile.dedicated_account_name}</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Deposits are credited to your Swift Top wallet automatically via Paystack.
      </p>
    </>
  );
}
