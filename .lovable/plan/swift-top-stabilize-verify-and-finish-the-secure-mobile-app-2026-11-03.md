# Swift Top: stabilize, verify, and finish the secure mobile-app experience

## Goal
Reset the app to a solid state: no build or runtime bugs, purchases priced and executed entirely server-side, biometric (fingerprint / Face ID) approval for payments, real-time 6-digit OTP verification, admin profits routed to segiruabdulfathi558@gmail.com, and a home-screen-installable mobile web app. No redesign of existing screens.

## Current state (verified this turn)
- The vend engine is already server-authoritative: the client sends only the chosen service, beneficiary details and the displayed price; the server resolves the Otapay wholesale cost and markup, verifies balance, PIN, and a server-issued biometric approval before debiting, and refunds on failure. Profit flows to the admin ledger automatically.
- Payment biometrics are wired: the PIN dialog runs a server-verified passkey check bound to the exact payment intent before charging. The raw-PIN localStorage shortcut and offline PIN storage are removed.
- The offline app-shell service worker has been replaced with a one-time cleanup worker; the manifest and install sheet remain for home-screen installation.
- The database migration for biometric transaction approvals applied successfully.

## Work
1. **Full error sweep.** Check the current build and runtime diagnostics, then fix every reported error across the auth screens, purchase screens, dialogs, and server functions. Re-check until the build is clean.
2. **End-to-end verification in the preview.** Drive the running app in a browser and confirm:
   - OTP sign-in screens render and validate correctly, with the 60-second resend timer, and no screen gets stuck loading.
   - A purchase flow shows the price, requires the PIN (and biometric when enabled), blocks insufficient balance, and refreshes the wallet after completion — using sandbox-safe checks, no real spend.
   - Withdrawal, funding, and vault flows open, validate, and complete without console errors.
3. **Server-side pricing and admin profit spot-check.** Confirm each service (airtime, data, cable, electricity, education) resolves its price server-side from the synced Otapay plans plus admin markup, and that the profit path and admin earnings view work for segiruabdulfathi558@gmail.com. Where a service has no live provider wholesale value, keep its existing approved pricing rule.
4. **Mobile app behavior.** Confirm the manifest, icons, and install sheet work and the install prompt hides when the app is already installed; confirm biometric enrollment and sign-in via fingerprint / Face ID on the device where the platform authenticator is available, with a clear fallback where it is not.
5. **Report anything that cannot be verified in the sandbox.** Real OTP email delivery depends on the configured Brevo SMTP — I will confirm the send path is wired and flag delivery itself as unverified. Provider API keys stay server-side throughout.

## Validation
- Build clean, no console/runtime errors during the browser walkthrough.
- Sign-in, purchase, funding, withdrawal, and history flows exercised once end-to-end.
- Existing tests (if any cover the changed behavior) run and pass.
