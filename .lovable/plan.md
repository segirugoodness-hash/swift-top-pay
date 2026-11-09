# Swift Top stability and quick access

## Goal
Fix reproducible app errors and make secure app access faster without changing the existing screen design or weakening payment checks.

## Work
1. Stop protected biometric settings requests from running on public/sign-in screens; show biometric controls only when a signed-in session is ready, and handle session changes, unsupported devices, cancellation, and loading/errors cleanly.
2. Verify installed-app access and the existing passkey flows: biometric sign-in, app unlock, and payment confirmation. Keep six-digit email-code sign-in as the fallback; do not store PINs or replay purchases automatically.
3. Stabilize payment completion: inspect the Otapay response and transaction state handling so a provider-confirmed purchase is never automatically refunded because local settlement logging failed; make duplicate requests return a safe, consistent state.
4. Review wallet, profile, history, OTP, funding, and service screens for reproducible blank screens, stuck loading, unhandled errors, and stale data after changes. Fix only confirmed issues and preserve existing pricing/security rules.
5. Validate the manifest, icons, install prompt, and mobile interaction, then verify the relevant public and authenticated flows and current diagnostics. Report any live service or device checks that require real credentials/hardware and cannot be confirmed here.

## Technical details
- Keep the existing TanStack Start, React Query, Lovable Cloud, and design tokens; use server-verified passkeys and authenticated server functions for protected actions.
- The current network report records two protected biometric-settings calls without an authorization header while the global lock component is mounted. The root currently mounts that component on every screen, including signed-out pages; the plan gates those requests on an authenticated session.
- No current build/runtime error log files or test files were found in the project signals reviewed. The existing PWA manifest is standalone and the current service worker is a cleanup-only worker; preserve those behaviors unless validation proves a defect.
