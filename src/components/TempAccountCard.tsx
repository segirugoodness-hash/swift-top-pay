import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Landmark, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Shows the user's live temporary funding account under the wallet balance, with copy + countdown. */
export function TempAccountCard() {
  const { data: acct, refetch } = useQuery({
    queryKey: ["temp-account"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("funding_requests")
        .select("id, account_number, bank_name, amount, expires_at, status")
        .eq("status", "pending")
        .neq("account_number", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!acct) return null;
  const left = Math.max(0, new Date(acct.expires_at).getTime() - now);
  if (left === 0) { void refetch(); return null; }
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  async function copy() {
    try { await navigator.clipboard.writeText(acct!.account_number); toast.success("Account number copied"); }
    catch { toast.error("Could not copy — long-press the number instead"); }
  }

  return (
    <div className="mt-3 rounded-2xl border border-primary/40 bg-surface/80 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Landmark className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Temporary funding account</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          <Timer className="h-3 w-3" /> {mm}:{ss}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{acct.bank_name}</p>
      <p className="font-display text-2xl font-bold tracking-wider text-foreground">{acct.account_number}</p>
      <p className="text-xs text-muted-foreground">Transfer exactly ₦{Number(acct.amount).toLocaleString()}</p>
      <button onClick={copy} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        <Copy className="h-4 w-4" /> Copy Account Number
      </button>
    </div>
  );
}
