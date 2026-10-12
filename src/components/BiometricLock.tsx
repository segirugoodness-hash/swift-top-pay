import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBiometrics, BIO_KEYS } from "@/hooks/useBiometrics";

/**
 * Full-screen app lock. Renders only when the user turned biometrics on
 * and the app was reopened or backgrounded since the last unlock.
 */
export function BiometricLock() {
  const { enabled, verify } = useBiometrics();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // A fresh page load always requires an unlock.
    if (sessionStorage.getItem(BIO_KEYS.UNLOCK_KEY) !== "1") setLocked(true);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.removeItem(BIO_KEYS.UNLOCK_KEY);
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [enabled]);

  const unlock = useCallback(async () => {
    setBusy(true);
    const ok = await verify();
    setBusy(false);
    if (ok) {
      sessionStorage.setItem(BIO_KEYS.UNLOCK_KEY, "1");
      setLocked(false);
    }
  }, [verify]);

  if (!enabled || !locked) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lock className="h-8 w-8" />
      </div>
      <div>
        <p className="font-display text-lg font-bold text-foreground">Swift Top is locked</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlock with your fingerprint or Face ID to continue.
        </p>
      </div>
      <Button onClick={unlock} disabled={busy} className="h-12 w-full max-w-xs rounded-full text-base font-semibold">
        <Fingerprint className="mr-2 h-5 w-5" />
        {busy ? "Waiting…" : "Unlock"}
      </Button>
    </div>
  );
}
