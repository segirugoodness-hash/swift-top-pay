import { useEffect, useState } from "react";
import { Share, Smartphone, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const DISMISS_KEY = "st_apk_banner_dismissed";

/** Manual iOS instructions — Safari has no programmatic install API. */
export function IosInstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Add Swift Top to your home screen</DialogTitle>
          <DialogDescription>Two taps in Safari and Swift Top opens like a normal app.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <Share className="h-4 w-4 shrink-0 text-primary" />
            Tap the <span className="font-medium text-foreground">Share</span> button in Safari.
          </li>
          <li className="flex items-center gap-3">
            <Plus className="h-4 w-4 shrink-0 text-primary" />
            Choose <span className="font-medium text-foreground">Add to Home Screen</span>.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Promotes installing Swift Top to the home screen, which is where
 * Fingerprint / Face ID login works reliably.
 * `dismissible` is used on the dashboard; the Profile copy always stays visible.
 */
export function AppDownloadBanner({ dismissible = false }: { dismissible?: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (dismissible && localStorage.getItem(DISMISS_KEY) === "1") setHidden(true);
  }, [dismissible]);

  // Already installed — nothing to promote.
  if (hidden || isStandalone) return null;

  async function handleInstall() {
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) return;
      return;
    }
    setShowIos(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-4">
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          className="absolute right-3 top-3 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 pr-6">
          <p className="font-display text-sm font-bold text-foreground">Get the Swift Top app</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Install the Swift Top app on your home screen to unlock instant Fingerprint &amp; Face ID login!
          </p>
        </div>
      </div>
      <Button
        onClick={() => { handleInstall().catch(() => undefined); }}
        className="mt-3 h-10 w-full rounded-full text-sm font-semibold"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add to Home Screen
      </Button>
      <IosInstallDialog open={showIos} onOpenChange={setShowIos} />
    </div>

  );
}
