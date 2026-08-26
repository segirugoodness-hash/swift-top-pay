import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Fingerprint } from "lucide-react";
import { downloadApp } from "@/components/AppDownloadBanner";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl text-center">
        <DialogHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Fingerprint className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display">Biometric login needs the app</DialogTitle>
          <DialogDescription>
            Biometric login requires the installed mobile application. Please tap "Download App" to install
            Swift Top on your phone!
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={() => { downloadApp().catch(() => undefined); }}
          className="mt-2 h-11 w-full rounded-full text-sm font-semibold"
        >
          <Download className="mr-2 h-4 w-4" />
          Download App
        </Button>
      </DialogContent>
    </Dialog>
  );
}
