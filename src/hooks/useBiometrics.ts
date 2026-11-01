import { useCallback, useEffect, useState } from "react";
import {
  setBiometricTransactionsEnabled,
  getBiometricTransactionsEnabled,
} from "@/lib/biometrics.functions";

export const BIO_KEYS = { UNLOCK_KEY: "st_bio_unlocked" };

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useBiometrics() {
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const serverValue = await getBiometricTransactionsEnabled();
      setEnabled(serverValue);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ok = typeof window !== "undefined" && !!window.PublicKeyCredential &&
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (alive) setSupported(!!ok);
      } catch {
        if (alive) setSupported(false);
      }
      if (alive) {
        setInstalled(detectStandalone());
        await refresh();
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  const enable = useCallback(async (): Promise<boolean> => {
    try {
      await setBiometricTransactionsEnabled(true);
      setEnabled(true);
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh]);

  const disable = useCallback(async (): Promise<boolean> => {
    try {
      await setBiometricTransactionsEnabled(false);
      setEnabled(false);
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh]);

  return {
    supported,
    installed,
    canEnroll: supported && installed,
    enabled,
    loading,
    enable,
    disable,
    refresh,
  };
}