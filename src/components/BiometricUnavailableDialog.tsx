import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Fingerprint } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { IosInstallDialog } from "@/components/AppDownloadBanner";
import { useState } from "react";

/**
 * Shown instead of an error whenever WebAuthn is unsupported, blocked, or running
 * inside a browser preview frame where platform authenticators are unavailable.
 */
export function BiometricUnavailableDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [showIos, setShowIos] = useState(false);

  async function install() {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowIos(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm rounded-2xl text-center">
          <DialogHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Fingerprint className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display">Biometric login needs the app</DialogTitle>
            <DialogDescription>
              Biometric login requires the installed Swift Top app. Add Swift Top to your home screen, then
              open it from your app icon to set up Fingerprint / Face ID.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => { install().catch(() => undefined); }}
            className="mt-2 h-11 w-full rounded-full text-sm font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add to Home Screen
          </Button>
        </DialogContent>
      </Dialog>
      <IosInstallDialog open={showIos} onOpenChange={setShowIos} />
    </>
  );
}
