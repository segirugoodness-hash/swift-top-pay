import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { ReferralPanel } from "@/components/ReferralPanel";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { SmartVaultCard } from "@/components/SmartVaultCard";

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

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Refer & Earn" subtitle="Invite 5 friends, earn ₦500 cashback" />
      <div className="flex-1 space-y-4 px-4 py-4 pb-24">
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <div className="flex items-center gap-2 text-primary"><Gift className="h-5 w-5" /><p className="font-semibold">Cashback tracker</p></div>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">{inRound} / {GOAL} <span className="text-base font-medium text-muted-foreground">Friends Joined</span></p>
          <Progress value={(inRound / GOAL) * 100} className="mt-3 h-3" />
          <p className="mt-2 text-xs text-muted-foreground">A friend counts once they sign up and fund their wallet.</p>
          <p className="mt-3 text-sm font-semibold text-foreground">{claimed > 0 ? `₦${(claimed*500).toLocaleString()} cashback paid to your Smart Vault` : `Invite ${GOAL - inRound} more to unlock ₦500 cashback`}</p>
          <p className="text-xs text-muted-foreground">Paid automatically to your Smart Vault at every 5 friends.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted-foreground">Your referral code</p><button className="font-display text-xl font-bold tracking-widest text-foreground" onClick={() => profile && navigator.clipboard.writeText(profile.id.slice(0, 8).toUpperCase())}>{profile?.id.slice(0, 8).toUpperCase()}</button></div>
        <ReferralPanel userId={profile?.id} />
        <SmartVaultCard />
      </div>
      <BottomNav />
    </div>
  );
}
