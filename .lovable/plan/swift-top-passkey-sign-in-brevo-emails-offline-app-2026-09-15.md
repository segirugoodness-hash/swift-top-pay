# Swift Top: passkey sign-in, Brevo emails, offline app

Most of the brief is already live in Swift Top (dark mobile dashboard, 6-digit code screens with the 60-second resend timer, all six service pages, wallet funding through the secure server layer with keys kept private, admin-only settings locked to your email, install banner). This plan builds the parts that are genuinely missing.

## 1. Fingerprint / Face ID sign-in (passkeys)

- New `user_passkeys` store so each phone's fingerprint key is tied to your account in the database, not just kept on the device.
- After a successful code sign-in, the existing prompt becomes "Enable Face ID / Touch ID for fast access" and registers a real passkey.
- New "Login with Biometrics" button on the sign-in screen: returning users sign in with a fingerprint, no code needed.
- Profile screen: list the phones you've enabled and let you remove one.
- Registration and sign-in are both checked on the server, so a stolen device key can't be replayed.

## 2. Code emails through Brevo

- Send Swift Top's own emails (receipts, notices) through Brevo using an API key you save securely — I'll ask for it when we build.
- For the sign-in/reset codes themselves, I'll switch account email delivery to your Brevo SMTP details. This one setting may need to be applied on your side if the platform doesn't expose it to me; if so I'll tell you exactly which two values to paste and where.

## 3. Offline retry queue

- If the connection drops mid-purchase, the airtime/data request is saved on the phone instead of failing.
- A small "1 pending purchase" chip appears; when the phone is back online the request is sent automatically and you get a success or refund notice.
- Every queued item carries a unique stamp so it can never be charged twice, and expires after a set window.

## 4. Installable app that opens offline

- Add a service worker so the app shell opens without internet and shows a clear offline screen for pages that need data.
- Keep the current install banner; make sure it appears reliably on Android/desktop and keeps the Share → Add to Home Screen guidance on iPhone.
- Sweep tap targets to a 48px minimum on the service forms.

Not building now: PDF receipts (you left that out).

## Technical notes

- Passkeys: `@simplewebauthn/browser` + `@simplewebauthn/server`; challenge issue/verify in authenticated TanStack server functions. New table `user_passkeys` (user_id, credential_id unique, public_key, counter, transports, device_label, created_at, last_used_at) with GRANTs, RLS scoped to `auth.uid()`, and a service-role-only lookup path for the pre-auth `credentials.get()` step (no user enumeration in the response).
- Passkey sign-in mints a session server-side after verification; bearer attach stays as-is.
- Brevo: `BREVO_API_KEY` secret, transactional send helper in a `*.server.ts` module. Supabase Auth SMTP override attempted via config tooling; documented manual fallback if unavailable.
- Offline queue: IndexedDB store of pending vend intents keyed by an idempotency reference reused by `begin_vend`, drained on `online` + on mount; retries capped with backoff. Server side already refunds on failure, so a duplicate drain is safe.
- Service worker follows the guarded PWA path (never registers in preview/dev), precaches the shell, network-first for data.
- Keys stay server-only; no new client-side calls to Paystack or Otapay.
