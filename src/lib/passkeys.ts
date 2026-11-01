import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  startPasskeyLogin,
  finishPasskeyLogin,
  startPaymentPasskey,
  finishPaymentPasskey,
} from "@/lib/passkeys.functions";
import type { PurchaseIntent } from "@/components/PinDialog";

/** Short, human label so users can recognise the device in their profile. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android phone";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  return "This device";
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** Enrols this device for fingerprint / Face ID sign-in. Requires an active session. */
export async function registerPasskey(): Promise<void> {
  const { challengeId, optionsJson } = await startPasskeyRegistration();
  const response = await startRegistration({ optionsJSON: JSON.parse(optionsJson) });
  await finishPasskeyRegistration({ data: { challengeId, label: deviceLabel(), response } });
  try {
    localStorage.setItem("st_bio_cred", response.id);
  } catch {
    // Server registration still works if local storage is unavailable.
  }
}

/** Authenticates this exact price and purchase intent before the server can charge it. */
export async function approvePaymentWithPasskey(intent: PurchaseIntent): Promise<string> {
  const { challengeId, optionsJson } = await startPaymentPasskey({
    data: {
      service: intent.service,
      details: intent.details,
      expectedRetail: intent.expectedRetail,
      idempotencyKey: intent.idempotencyKey,
    },
  });
  const response = await startAuthentication({ optionsJSON: JSON.parse(optionsJson) });
  const result = await finishPaymentPasskey({ data: { challengeId, response: response as never } });
  return result.challengeId;
}

/** Signs in with the device fingerprint / Face ID and establishes the Supabase session. */
export async function signInWithPasskey(): Promise<void> {
  const { challengeId, optionsJson } = await startPasskeyLogin();
  const response = await startAuthentication({ optionsJSON: JSON.parse(optionsJson) });
  const { tokenHash } = await finishPasskeyLogin({
    data: { challengeId, response: response as never },
  });
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) throw new Error(error.message);
}
