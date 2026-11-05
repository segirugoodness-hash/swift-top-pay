import { getRequest } from "@tanstack/react-start/server";

export type WebAuthnOrigin = { rpID: string; origin: string };

/**
 * Server-only: derives the WebAuthn relying-party ID and origin from the current
 * request headers so passkey verification matches whatever domain serves the app.
 */
export function requestOrigin(): WebAuthnOrigin {
  const req = getRequest();
  const explicit = req?.headers.get("origin");
  const host = req?.headers.get("host") ?? "localhost";
  const proto = req?.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = explicit ?? `${proto}://${host}`;
  const rpID = new URL(origin).hostname;
  return { rpID, origin };
}
