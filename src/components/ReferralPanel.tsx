import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type ReferralRow = { id: string; status: string; reward_amount: number; created_at: string };

export function ReferralPanel({ userId }: { userId: string | undefined }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["referrals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, status, reward_amount, created_at")
        .eq("referrer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReferralRow[];
    },
    staleTime: 30_000,
  });

  const link = userId && typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${userId}` : "";
  const rewarded = rows.filter((r) => r.status === "rewarded");
  const earned = rewarded.reduce((s, r) => s + Number(r.reward_amount ?? 0), 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Referral link copied");
    } catch {
      toast.error("Could not copy — long-press the link instead");
    }
  }

  async function share() {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (!nav.share) return copy();
    try {
      await nav.share({ title: "Swift Top", text: "Buy cheap data and airtime on Swift Top", url: link });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Invite &amp; earn</p>
          <p className="text-xs text-muted-foreground">₦10 when a friend funds their wallet</p>
        </div>
      </div>

      <p className="truncate rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        {link || "—"}
      </p>

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="h-10 flex-1 rounded-full text-xs" onClick={copy} disabled={!link}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
        </Button>
        <Button variant="outline" className="h-10 flex-1 rounded-full text-xs" onClick={share} disabled={!link}>
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Referrals" value={String(rows.length)} />
        <Stat label="Earned" value={`₦${earned.toLocaleString()}`} />
      </div>
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
