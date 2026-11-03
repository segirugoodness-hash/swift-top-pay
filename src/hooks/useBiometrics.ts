import { useCallback, useEffect, useState } from "react";
import {
  setBiometricTransactionsEnabled,
  getBiometricTransactionsEnabled,
} from "@/lib/biometrics.functions";

export const BIO_KEYS = { CRED_KEY: "st_bio_cred", UNLOCK_KEY: "st_bio_unlocked" };
const LEGACY_PIN_KEY = "st_bio_pin";

function localChallenge(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(bytes);
  return bytes;
}

function decodeCredentialId(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useBiometrics() {
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      localStorage.removeItem(LEGACY_PIN_KEY);
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
        try {
          setLocalEnabled(!!localStorage.getItem("st_bio_cred"));
        } catch {
          setLocalEnabled(false);
        }
        await refresh();
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  const enable = useCallback(async (): Promise<boolean> => {
    try {
      const rawId = localStorage.getItem(BIO_KEYS.CRED_KEY);
      if (!rawId) throw new Error("Set up a passkey on this device first");
      await setBiometricTransactionsEnabled({ data: true });
      setEnabled(true);
      setLocalEnabled(true);
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh]);

  const disable = useCallback(async (): Promise<boolean> => {
    try {
      await setBiometricTransactionsEnabled({ data: false });
      setEnabled(false);
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh]);

  const enableLocalUnlock = useCallback(async (): Promise<boolean> => {
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: localChallenge(),
          rp: { name: "Swift Top", id: window.location.hostname },
          user: { id: localChallenge(), name: "swift-top-user", displayName: "Swift Top" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
          timeout: 60_000,
          attestation: "none",
        },
      }) as PublicKeyCredential | null;
      if (!credential) return false;
      const bytes = new Uint8Array(credential.rawId);
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      localStorage.setItem(BIO_KEYS.CRED_KEY, btoa(binary));
      localStorage.setItem(BIO_KEYS.UNLOCK_KEY, "1");
      setLocalEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disableLocalUnlock = useCallback(() => {
    localStorage.removeItem(BIO_KEYS.CRED_KEY);
    localStorage.removeItem(BIO_KEYS.UNLOCK_KEY);
    setLocalEnabled(false);
  }, []);

  const verify = useCallback(async (): Promise<boolean> => {
    const storedId = localStorage.getItem(BIO_KEYS.CRED_KEY);
    if (!storedId) return false;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: localChallenge(),
          allowCredentials: [{ type: "public-key", id: decodeCredentialId(storedId) }],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      return !!assertion;
    } catch {
      return false;
    }
  }, []);

  return {
    supported,
    installed,
    canEnroll: supported && installed,
    enabled,
    localEnabled,
    loading,
    enable,
    disable,
    enableLocalUnlock,
    disableLocalUnlock,
    verify,
    refresh,
  };
}