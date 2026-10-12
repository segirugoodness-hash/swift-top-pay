# Swift Top: faster data, OTP-only sign-in, install-only PWA

## Goal
Reduce repeated account-data requests, preserve accurate wallet balances after actions, use numeric email codes for email sign-in, and keep phone installation support without offline app caching or changes to the established dashboard layout.

## Work
1. **Query caching:** Set sensible shared TanStack Query defaults so returning to dashboard tabs does not immediately refetch unchanged data. Keep profile data cached and deduplicate reads; replace the many per-component auth listeners in `useProfile` with one identity-aware listener. Clear user-specific cached data on sign-out/account change, and invalidate/update profile and transaction queries after funding, spending, withdrawals, and other balance-changing actions.
2. **OTP authentication:** Make email sign-in OTP-only, keep the numeric six-digit verification and resend countdown, and use the connected project client for sign-up, sign-in, recovery, and PIN-change verification. Retain registered passkey sign-in as its separate biometric option. Keep loading, errors, and success feedback explicit; do not introduce magic-link screens.
3. **Install-only PWA:** Keep the existing `.webmanifest` (the browser-supported manifest format), standalone display mode, Swift Top colors, and validated 192, 512, maskable, and Apple touch icons. Do not add a duplicate `manifest.json`. Retire the current offline cache behavior and safely unregister the old app-shell worker without deleting unrelated browser caches. Preserve the existing install prompt and iOS guidance.
4. **Main-thread work:** Review the requested client data paths and remove only confirmed blocking work that materially affects those flows; keep small bounded UI transformations synchronous and avoid speculative rewrites.

## Technical details
- Tune the per-router `QueryClient` defaults with a short freshness window and disable focus-triggered refetches; allow frequently changing or security-sensitive queries to override defaults. Preserve the existing per-request QueryClient construction.
- Scope cached account data to the authenticated identity where appropriate. Centralize auth transition handling rather than registering listeners in every `useProfile` consumer.
- Keep balances server-authoritative: refresh the cache after successful mutations and preserve current database/RLS behavior. No changes to wallet rules, admin permissions, provider calls, or receipt functionality.
- Keep existing PWA asset paths and colors if verification confirms they match the manifest; use a one-release cleanup worker at the existing worker path to remove only Swift Top's named app-shell cache and unregister itself.

## Validation
- Check profile and balance queries remain cached across navigation, auth transitions do not leak cached user data, and successful balance-changing actions refresh the visible wallet.
- Verify email sign-in and signup use six-digit codes, recovery and PIN verification remain code-based, and passkey sign-in remains available.
- Verify the manifest parses, required icon files resolve with expected dimensions, standalone/colors remain correct, the install UI remains available, and the former app-shell worker no longer caches or serves the app offline.
- Review diagnostics and run the existing focused checks for any behavior-specific tests.
