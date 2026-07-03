import { createFileRoute } from "@tanstack/react-router";
import { Bell, Phone, Wifi, Zap, Tv, GraduationCap, ArrowLeftRight } from "lucide-react";
import { WalletCard } from "@/components/WalletCard";
import { ServiceCard } from "@/components/ServiceCard";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[color:oklch(0.78_0.15_190)] to-[color:oklch(0.62_0.18_160)] font-display text-lg font-bold text-black">
            AO
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="text-sm font-semibold text-foreground">08012345678</p>
          </div>
        </div>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[color:oklch(0.72_0.18_160)]" />
        </button>
      </header>

      {/* Wallet */}
      <div className="px-4">
        <WalletCard />
      </div>

      {/* Quick services */}
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

      {/* Recent transactions */}
      <section className="mt-6 flex-1 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent transactions</h2>
          <button className="text-xs font-medium text-primary">See all</button>
        </div>
        <div className="rounded-2xl border border-dashed border-border/70 bg-surface/50 p-6 text-center">
          <p className="text-sm font-medium text-foreground">No transactions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your recent bill payments will appear here.
          </p>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
