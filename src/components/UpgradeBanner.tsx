import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { FundWalletDialog } from "@/components/FundWalletDialog";

export function UpgradeBanner() {
  const { data: profile } = useProfile();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  if (!profile || profile.account_tier === "verified" || dismissed) return null;
  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-xs">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/25 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 leading-snug text-foreground">
          <p className="font-semibold">Upgrade Account</p>
          <p className="text-muted-foreground">
            Provide your BVN to unlock your permanent personal bank account for automated instant funding.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Upgrade now →
          </button>
        </div>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <FundWalletDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
