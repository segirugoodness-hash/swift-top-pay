import { Eye, EyeOff, Plus, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { FundWalletDialog } from "@/components/FundWalletDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";

export function WalletCard() {
  const [visible, setVisible] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { data: profile, isLoading } = useProfile();
  const balance = Number(profile?.wallet_balance ?? 0);
  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl p-5 shadow-wallet"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.72 0.17 190) 0%, oklch(0.62 0.18 165) 60%, oklch(0.48 0.14 190) 100%)",
        }}
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/20 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-black/70">
            Wallet Balance
          </span>
          <button
            onClick={() => setVisible((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-black/80"
            aria-label="Toggle balance"
          >
            {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative mt-3 flex items-baseline gap-1 text-black">
          <span className="text-2xl font-semibold">₦</span>
          <span className="font-display text-4xl font-bold tracking-tight">
            {isLoading ? "…" : visible ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "••••••"}
          </span>
        </div>

        <div className="relative mt-5 flex gap-2">
          <button
            onClick={() => setFundOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-black/85 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Fund
          </button>
          <button
            onClick={() => setWithdrawOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/85 py-2.5 text-sm font-semibold text-black"
          >
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </button>
        </div>
      </div>

      <FundWalletDialog open={fundOpen} onOpenChange={setFundOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </>
  );
}
