import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell, Phone, Wifi, Zap, Tv, GraduationCap, ArrowLeftRight, LogOut, Shield } from "lucide-react";
import { WalletCard } from "@/components/WalletCard";
import { ServiceCard } from "@/components/ServiceCard";
import { BottomNav } from "@/components/BottomNav";
import { useProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "SU").trim();
  const parts = src.split(/\s+/);
  return (parts[0]?.[0] ?? "S").toUpperCase() + (parts[1]?.[0] ?? parts[0]?.[1] ?? "U").toUpperCase();
}

function Dashboard() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Force PIN setup for new users
  useEffect(() => {
    if (profile && !profile.transaction_pin_hash) {
      navigate({ to: "/create-pin", replace: true });
    }
  }, [profile, navigate]);

  const { data: recent } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const display = profile?.phone || "08012345678";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[color:oklch(0.78_0.15_190)] to-[color:oklch(0.62_0.18_160)] font-display text-lg font-bold text-black">
            {initials(profile?.full_name)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="text-sm font-semibold text-foreground">{display}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[color:oklch(0.72_0.18_160)]" />
          </button>
          <button
            onClick={() => { signOut().catch(() => toast.error("Could not sign out")); }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="px-4">
        <WalletCard />
      </div>

      <section className="mt-6 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Quick services</h2>
          <span className="text-xs text-muted-foreground">Tap to pay</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ServiceCard to="/airtime" label="Buy Airtime" icon={Phone} tint="teal" />
          <ServiceCard to="/data" label="Buy Data" icon={Wifi} tint="emerald" />
          <ServiceCard to="/electricity" label="Electricity" icon={Zap} tint="teal" />
          <ServiceCard to="/cable" label="Cable TV" icon={Tv} tint="emerald" />
          <ServiceCard to="/education" label="Education PINs" icon={GraduationCap} tint="teal" />
          <ServiceCard to="/airtime-to-cash" label="Airtime to Cash" icon={ArrowLeftRight} tint="emerald" />
        </div>
      </section>

      <section className="mt-6 flex-1 px-4 pb-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
          <button className="text-xs font-medium text-primary">See all</button>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="space-y-2">
            {recent.map((tx: { id: string; type: string; amount: number; status: string; created_at: string }) => (
              <li key={tx.id} className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold capitalize text-foreground">{tx.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">−₦{Number(tx.amount).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-surface/50 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No transactions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your recent bill payments will appear here.</p>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
