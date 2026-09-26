import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { ReferralPanel } from "@/components/ReferralPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/refer")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — Swift Top" },
      { name: "description", content: "Invite 5 friends to Swift Top and claim wallet cashback." },
      { property: "og:title", content: "Refer & Earn — Swift Top" },
      { property: "og:description", content: "Invite 5 friends to Swift Top and claim wallet cashback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferPage,
});

const GOAL = 5;

function ReferPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["refer-progress", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const [{ count }, { data: claims }] = await Promise.all([
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", profile!.id).eq("status", "rewarded"),
        supabase.from("referral_claims").select("milestone").eq("user_id", profile!.id),
      ]);
      const claimed = Math.max(0, ...(claims ?? []).map((c) => c.milestone));
      return { qualified: count ?? 0, claimed };
    },
  });
  const qualified = data?.qualified ?? 0;
  const claimed = data?.claimed ?? 0;
  const inRound = Math.min(GOAL, qualified - claimed * GOAL);
  const canClaim = qualified >= (claimed + 1) * GOAL;

  async function claim() {
    setBusy(true);
    const { data: amt, error } = await supabase.rpc("claim_referral_cashback");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`₦${Number(amt).toLocaleString()} cashback added to your wallet`);
    qc.invalidateQueries();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Refer & Earn" subtitle="Invite 5 friends, earn ₦500 cashback" />
      <div className="flex-1 space-y-4 px-4 py-4 pb-24">
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <div className="flex items-center gap-2 text-primary"><Gift className="h-5 w-5" /><p className="font-semibold">Cashback tracker</p></div>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">{inRound} / {GOAL} <span className="text-base font-medium text-muted-foreground">Friends Joined</span></p>
          <Progress value={(inRound / GOAL) * 100} className="mt-3 h-3" />
          <p className="mt-2 text-xs text-muted-foreground">A friend counts once they sign up and fund their wallet.</p>
          <Button className="mt-4 h-12 w-full rounded-full text-base font-semibold" disabled={!canClaim || busy} onClick={claim}>
            {busy ? "Claiming…" : canClaim ? "Claim Cashback" : `Invite ${GOAL - inRound} more to unlock`}
          </Button>
        </div>
        <ReferralPanel userId={profile?.id} />
      </div>
      <BottomNav />
    </div>
  );
}
