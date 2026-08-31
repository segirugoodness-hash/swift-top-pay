import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BiometricUnavailableDialog } from "@/components/BiometricUnavailableDialog";
import { useBiometrics } from "@/hooks/useBiometrics";

/** Set by auth.tsx on a successful sign-in / verification; consumed once here. */
export const BIO_OFFER_KEY = "st_bio_offer";
const ASKED_KEY = "st_bio_asked";

/** Marks that this device should be offered biometric enrollment after redirect. */
export function offerBiometricSetup() {
  try {
    if (localStorage.getItem(ASKED_KEY) !== "1") sessionStorage.setItem(BIO_OFFER_KEY, "1");
  } catch {
    // storage can be unavailable in private modes — enrollment stays manual
  }
}

/**
 * One-time post-sign-in prompt to turn on Fingerprint / Face ID quick unlock.
 * Never blocks navigation: it renders on top of the dashboard and is skippable.
 */
export function BiometricSetupSheet() {
  const { supported, enabled, enable } = useBiometrics();
  const [open, setOpen] = useState(false);
  const [needApp, setNeedApp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (enabled) return;
    if (sessionStorage.getItem(BIO_OFFER_KEY) !== "1") return;
    if (localStorage.getItem(ASKED_KEY) === "1") return;
    setOpen(true);
  }, [enabled]);

  function close() {
    localStorage.setItem(ASKED_KEY, "1");
    sessionStorage.removeItem(BIO_OFFER_KEY);
    setOpen(false);
  }

  async function handleEnable() {
    if (!supported) {
      close();
      setNeedApp(true);
      return;
    }
    setBusy(true);
    const ok = await enable();
    setBusy(false);
    close();
    if (ok) toast.success("Fingerprint / Face ID enabled for this device");
    else setNeedApp(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-sm rounded-2xl text-center">
          <DialogHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Fingerprint className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display">Enable Fingerprint / Face ID?</DialogTitle>
            <DialogDescription>
              Skip typing codes next time — unlock Swift Top and approve payments with your fingerprint or
              Face ID on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            <Button
              onClick={() => { handleEnable().catch(() => undefined); }}
              disabled={busy}
              className="h-11 w-full rounded-full text-sm font-semibold"
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              {busy ? "Waiting…" : "Enable"}
            </Button>
            <button type="button" onClick={close} className="w-full py-2 text-sm text-muted-foreground">
              Not now
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <BiometricUnavailableDialog open={needApp} onOpenChange={setNeedApp} />
    </>
  );
}
