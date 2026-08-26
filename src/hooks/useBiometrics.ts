import { useCallback, useEffect, useState } from "react";

/**
 * Device-local biometric unlock (WebAuthn platform authenticator: Fingerprint / Face ID).
 *
 * Scope on purpose: this is a *local device* gate, not a server auth factor.
 * The Supabase session and the server-side PIN check remain the real security boundary —
 * a successful biometric assertion only unlocks values already stored on this device.
 */
const CRED_KEY = "st_bio_cred";
const PIN_KEY = "st_bio_pin";
const UNLOCK_KEY = "st_bio_unlocked";

function randomChallenge(): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(b);
  return b;
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const raw = atob(s);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function useBiometrics() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ok =
          typeof window !== "undefined" &&
          !!window.PublicKeyCredential &&
          (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        if (alive) setSupported(!!ok);
      } catch {
        if (alive) setSupported(false);
      }
      if (alive) {
        setEnabled(!!localStorage.getItem(CRED_KEY));
        setPinSaved(!!localStorage.getItem(PIN_KEY));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Registers a platform credential on this device. Optionally remembers the transaction PIN. */
  const enable = useCallback(async (pin?: string): Promise<boolean> => {
    try {
      const userId = randomChallenge();
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge(),
          rp: { name: "Swift Top", id: window.location.hostname },
          user: { id: userId, name: "swift-top-user", displayName: "Swift Top" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60_000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      localStorage.setItem(CRED_KEY, toB64(cred.rawId));
      if (pin && /^\d{4}$/.test(pin)) {
        localStorage.setItem(PIN_KEY, pin);
        setPinSaved(true);
      }
      localStorage.setItem(UNLOCK_KEY, "1");
      setEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const disable = useCallback(() => {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(UNLOCK_KEY);
    setEnabled(false);
    setPinSaved(false);
  }, []);

  /** Prompts Fingerprint / Face ID. Returns true only on a successful assertion. */
  const verify = useCallback(async (): Promise<boolean> => {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return false;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge(),
          allowCredentials: [{ id: fromB64(raw), type: "public-key" }],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      return !!assertion;
    } catch {
      return false;
    }
  }, []);

  /** Releases the locally stored PIN, but only behind a fresh biometric assertion. */
  const unlockPin = useCallback(async (): Promise<string | null> => {
    if (!localStorage.getItem(PIN_KEY)) return null;
    const ok = await verify();
    return ok ? localStorage.getItem(PIN_KEY) : null;
  }, [verify]);

  const rememberPin = useCallback((pin: string) => {
    if (/^\d{4}$/.test(pin)) {
      localStorage.setItem(PIN_KEY, pin);
      setPinSaved(true);
    }
  }, []);

  return { supported, enabled, pinSaved, enable, disable, verify, unlockPin, rememberPin };
}

export const BIO_KEYS = { CRED_KEY, PIN_KEY, UNLOCK_KEY };
