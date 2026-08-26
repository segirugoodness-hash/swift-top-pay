import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { createTempTransferAccount, checkFundingStatus } from "@/lib/funding.functions";
import { initPaystackFunding } from "@/lib/paystack.functions";
import { openPaystackCheckout } from "@/lib/paystack-inline";

type Session = {
  reference: string;
  amount: number;
  expires_at: string;
  available: boolean;
  account_number: string;
  bank_name: string;
  account_name: string;
};

function useCountdown(expiresAt?: string) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

/** Temporary virtual account top-up: dynamic account number, 30-minute timer, live polling. */
export function TempTransferPanel({ onCredited }: { onCredited: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"pending" | "success" | "failed">("pending");
  const create = useServerFn(createTempTransferAccount);
  const check = useServerFn(checkFundingStatus);
  const initPaystack = useServerFn(initPaystackFunding);
  const qc = useQueryClient();
  const secondsLeft = useCountdown(session?.expires_at);

  useEffect(() => {
    if (!session || status === "success" || secondsLeft <= 0) return;
    const id = setInterval(() => {
      check({ data: { reference: session.reference } })
        .then((r) => {
          if (r.status === "success") {
            setStatus("success");
            qc.invalidateQueries({ queryKey: ["profile"] });
            toast.success("Wallet funded successfully");
            onCredited();
          }
        })
        .catch(() => {/* network hiccup — keep polling silently */});
    }, 10_000);
    return () => clearInterval(id);
  }, [session, status, secondsLeft, check, qc, onCredited]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt < 100) return toast.error("Enter at least ₦100");
    setBusy(true);
    try {
      const s = await create({ data: { amount: amt } });
      setSession(s);
      setStatus("pending");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <form onSubmit={start} className="mt-3 flex flex-col gap-4">
        <div>
          <Label htmlFor="tt-amt" className="mb-2 block text-sm">Amount (₦)</Label>
          <Input id="tt-amt" inputMode="numeric" placeholder="5000" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          <div className="mt-2 flex flex-wrap gap-2">
            {["1000", "2000", "5000", "10000"].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                ₦{v}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={busy} className="h-11 rounded-full">
          <Building2 className="mr-2 h-4 w-4" />
          {busy ? "Generating account…" : "Generate transfer account"}
        </Button>
        <p className="rounded-xl border border-border/60 bg-surface/60 p-3 text-[11px] text-muted-foreground">
          A one-time account number valid for 30 minutes. Your wallet is credited automatically the moment
          the transfer lands.
        </p>
      </form>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (status === "success") {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <p className="text-sm font-bold text-foreground">₦{session.amount.toLocaleString()} received</p>
        <p className="text-xs text-muted-foreground">Your wallet balance has been updated.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {session.available ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Transfer exactly</p>
          <p className="font-display text-2xl font-bold text-primary">₦{session.amount.toLocaleString()}</p>
          <div className="mt-3 space-y-2">
            <Detail label="Account number" value={session.account_number} copyable />
            <Detail label="Bank" value={session.bank_name} />
            <Detail label="Account name" value={session.account_name} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm font-bold text-primary">Account being assigned</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Our bank partner is issuing your one-time account number. You can use the
            <span className="font-semibold text-foreground"> Pay now </span>
            tab to fund instantly with card, USSD or transfer while this completes.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface/60 px-4 py-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {secondsLeft > 0 ? "Expires in" : "Expired — generate a new account"}
        </span>
        <span className="font-display text-sm font-bold text-foreground">{mm}:{ss}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        Waiting for your transfer… this screen updates automatically.
      </div>

      <Button variant="outline" className="h-10 w-full rounded-full" onClick={() => setSession(null)}>
        Change amount
      </Button>
    </div>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {value}
        {copyable && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}>
            <Copy className="h-3.5 w-3.5 text-primary" />
          </button>
        )}
      </span>
    </div>
  );
}
