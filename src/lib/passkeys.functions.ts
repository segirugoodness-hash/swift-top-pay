import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
type VendService = "airtime" | "data" | "electricity" | "cable" | "education";

/**
 * Server-verified passkeys (Fingerprint / Face ID sign-in).
 *
 * Registration is only possible for a signed-in user. Sign-in is public but proves
 * possession of a private key that matches a public key we stored earlier, and every
 * challenge is single-use and expires after 5 minutes.
 */

type WebAuthnOrigin = { rpID: string; origin: string };

async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestOrigin(): WebAuthnOrigin {
  const req = getRequest();
  const explicit = req?.headers.get("origin");
  const host = req?.headers.get("host") ?? "localhost";
  const proto = req?.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = explicit ?? `${proto}://${host}`;
  const rpID = new URL(origin).hostname;
  return { rpID, origin };
}

/** Step 1 of enrolment — returns the browser options and a challenge id to send back. */
export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = requestOrigin();
    const email = (context.claims["email"] as string | undefined) ?? "swift-top-user";

    const { data: existing } = await supabaseAdmin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);

    const options = await generateRegistrationOptions({
      rpName: "Swift Top",
      rpID,
      userID: new TextEncoder().encode(context.userId),
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as never,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });

    const { data: row, error } = await supabaseAdmin
      .from("passkey_challenges")
      .insert({
        user_id: context.userId,
        email,
        purpose: "register",
        challenge: options.challenge,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // A JSON string keeps the RPC payload plainly serializable across the server boundary.
    return { challengeId: row.id, optionsJson: JSON.stringify(options) };
  });

/** Step 2 of enrolment — verifies the device response and saves the public key. */
export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string; label: string; response: unknown }) => input)
  .handler(async ({ data, context }) => {
    const [{ resolveVendQuote }, { vendIntentString }] = await Promise.all([
      import("@/lib/vend-pricing.server"),
      import("@/lib/vend-intent.server"),
    ]);
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = requestOrigin();

    const { data: ch } = await supabaseAdmin
      .from("passkey_challenges")
      .select("id, challenge, user_id, purpose, expires_at, consumed_at")
      .eq("id", data.challengeId)
      .maybeSingle();

    if (
      !ch ||
      ch.purpose !== "register" ||
      ch.user_id !== context.userId ||
      ch.consumed_at ||
      new Date(ch.expires_at).getTime() < Date.now()
    ) {
      throw new Error("That biometric setup request expired. Please try again.");
    }
    await supabaseAdmin
      .from("passkey_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", ch.id);

    const verification = await verifyRegistrationResponse({
      response: data.response as never,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("We couldn't confirm that fingerprint / Face ID. Please try again.");
    }

    const cred = verification.registrationInfo.credential;
    const { error } = await supabaseAdmin.from("user_passkeys").upsert(
      {
        user_id: context.userId,
        credential_id: cred.id,
        public_key: Buffer.from(cred.publicKey).toString("base64"),
        counter: cred.counter,
        transports: (cred.transports ?? []) as string[],
        device_label: data.label.slice(0, 60),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "credential_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Public: issues a one-time challenge for a fingerprint sign-in. */
export const startPasskeyLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { rpID, origin } = requestOrigin();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  const { data: row, error } = await supabaseAdmin
    .from("passkey_challenges")
    .insert({ purpose: "login", challenge: options.challenge })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { challengeId: row.id, optionsJson: JSON.stringify(options) };
});

/**
 * Public: verifies the assertion and, on success, returns a single-use token hash the
 * browser exchanges for a Supabase session. No password or email code needed.
 */
export const finishPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { challengeId: string; response: { id: string } & Record<string, unknown> }) => input)
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = requestOrigin();

    const { data: ch } = await supabaseAdmin
      .from("passkey_challenges")
      .select("id, challenge, purpose, expires_at, consumed_at")
      .eq("id", data.challengeId)
      .maybeSingle();

    if (!ch || ch.purpose !== "login" || ch.consumed_at || new Date(ch.expires_at).getTime() < Date.now()) {
      throw new Error("That sign-in request expired. Please try again.");
    }
    await supabaseAdmin
      .from("passkey_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", ch.id);

    const { data: cred } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", data.response.id)
      .maybeSingle();
    if (!cred) throw new Error("This device isn't set up for fingerprint sign-in yet.");

    const verification = await verifyAuthenticationResponse({
      response: data.response as never,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64")),
        counter: Number(cred.counter),
        transports: (cred.transports ?? []) as never,
      },
    });
    if (!verification.verified) throw new Error("Fingerprint check failed. Please try again.");

    await supabaseAdmin
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", cred.id);

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(cred.user_id);
    if (userErr || !userRes.user?.email) throw new Error("We couldn't find that account.");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userRes.user.email,
    });
    if (linkErr || !link.properties?.hashed_token) {
      throw new Error("We couldn't start your session. Please sign in with a code instead.");
    }

    return { email: userRes.user.email, tokenHash: link.properties.hashed_token };
  });

/** Creates a device challenge bound to the exact server-resolved purchase quote. */
export const startPaymentPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    service: VendService;
    details: Record<string, unknown>;
    expectedRetail: number;
    idempotencyKey: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles").select("biometric_transactions_enabled").eq("id", context.userId).maybeSingle();
    if (profileError || !profile?.biometric_transactions_enabled) throw new Error("Payment biometrics are not enabled");

    const { data: credentials, error: credentialsError } = await context.supabase
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);
    if (credentialsError || !credentials?.length) throw new Error("Set up a passkey on this device first");

    const quote = await resolveVendQuote(context.supabase, data.service, data.details);
    if (quote.retail !== data.expectedRetail) throw new Error("Price changed. Review the updated price before paying.");
    const intentHash = await hashText(vendIntentString(data.service, data.details, data.idempotencyKey, quote.retail));
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = requestOrigin();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: (credential.transports ?? []) as never,
      })),
    });
    const { data: challenge, error } = await supabaseAdmin.from("passkey_challenges").insert({
      user_id: context.userId,
      email: (context.claims["email"] as string | undefined) ?? null,
      purpose: "payment",
      challenge: options.challenge,
      intent_hash: intentHash,
    }).select("id").single();
    if (error) throw new Error("Could not start biometric payment approval");
    return { challengeId: challenge.id, optionsJson: JSON.stringify(options) };
  });

/** Verifies an assertion and consumes the challenge once; vend RPC consumes approval once more. */
export const finishPaymentPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { challengeId: string; response: { id: string } & Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { rpID, origin } = requestOrigin();
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("passkey_challenges")
      .select("id, challenge, purpose, user_id, expires_at, consumed_at, used_at, intent_hash")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (challengeError || !challenge || challenge.purpose !== "payment" || challenge.user_id !== context.userId ||
        !challenge.intent_hash || challenge.consumed_at || challenge.used_at ||
        new Date(challenge.expires_at).getTime() <= Date.now()) {
      throw new Error("That biometric payment request expired. Please try again.");
    }

    const { data: credential, error: credentialError } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("user_id", context.userId)
      .eq("credential_id", data.response.id)
      .maybeSingle();
    if (credentialError || !credential) throw new Error("This device is not registered for biometric approval");

    const verification = await verifyAuthenticationResponse({
      response: data.response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64")),
        counter: Number(credential.counter),
        transports: (credential.transports ?? []) as never,
      },
    });
    if (!verification.verified) throw new Error("Fingerprint check failed. Please try again.");

    const { error: counterError } = await supabaseAdmin.from("user_passkeys").update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    }).eq("id", credential.id);
    if (counterError) throw new Error("Could not complete biometric verification");

    const { data: consumed, error: consumeError } = await supabaseAdmin.from("passkey_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id).eq("user_id", context.userId).is("consumed_at", null).is("used_at", null)
      .select("id").maybeSingle();
    if (consumeError || !consumed) throw new Error("That biometric approval was already used");
    return { challengeId: consumed.id };
  });

/** The devices a signed-in user has enabled. */
export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_passkeys")
      .select("id, device_label, created_at, last_used_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Removes one enrolled device. RLS keeps this to the owner's own rows. */
export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_passkeys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
