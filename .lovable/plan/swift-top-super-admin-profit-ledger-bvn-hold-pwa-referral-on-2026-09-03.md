# Swift Top — Super Admin, Profit Ledger, BVN Hold, PWA & Referral Onboarding

## 1. Super Admin privileges

- `segiruabdulfathi558@gmail.com` stays the single Super Admin identity, recognised both in the app (admin route gate) and in the database.
- Admin Console gains a **Users** tab:
  - Search users by phone, name or email; see wallet balance, tier and verification status.
  - **Manual wallet credit / debit** with a required reason. Every adjustment writes a transaction row so it shows in the user's own history and in reporting.
- All admin reads/writes go through server functions that first confirm the caller's email is the Super Admin, then use privileged access — so admin actions are never blocked by per-user access rules, and no broad public access is opened.

## 2. Profit margin routing to the Admin Dashboard

- New `admin_profits` table: one row per completed sale — user, service type, transaction reference, price charged, provider cost, margin, timestamp.
- The existing atomic purchase flow (`complete_vend`) writes this row in the same database step that credits the admin earnings wallet, so nothing is lost when a purchase succeeds and nothing is written when it fails/refunds.
- The Airtime-to-Cash 5% admin cut is logged the same way.
- Admin Dashboard "Earnings" panel is extended: total lifetime profit, profit this month, a per-service breakdown, and the latest profit entries. The existing earnings wallet and profit withdrawal flow are untouched.

## 3. Dedicated virtual accounts on hold (BVN flow)

- No live Paystack dedicated-account API calls. Fund Wallet gets a clear **Dedicated Bank Account** option that opens the BVN modal (11 digits + legal first/last name, validated).
- On submit, details are stored on the user's profile with status "pending" and the notice shows: "Your BVN has been submitted successfully. Your personal virtual account is being processed and will be assigned to your dashboard shortly."
- Standard Paystack pop-up checkout (card / USSD / transfer) stays the active instant funding path and is surfaced right under the pending notice.
- Admin Users tab shows pending BVN submissions so accounts can be issued manually later.

## 4. PWA install + biometric guard

- Manifest, icons and Apple touch icon are already live and stay as they are; installability is confirmed end to end. No service worker / offline caching, per your choice — this avoids stale-cache and white-screen risk on a payments app.
- Install button behaviour: Android/desktop fires the native install prompt; iOS shows the Safari **Share → Add to Home Screen** instructions; the banner hides once the app is installed.
- Biometric guard tightens: Fingerprint / Face ID enrolment now requires the installed (standalone) app. In a normal browser tab it shows "Please tap 'Add to Home Screen' to install Swift Top and enable Biometric Login." with the install action inline. Applies to the post-sign-in enrolment sheet and the Profile toggle.

## 5. Referral & invitation flow

- New public `/signup?ref=USER_ID` page: greets the user with the referrer's name, shows an **Install App** banner, and continues into account creation with the referral code persisted (survives OTP verification).
- Referral links generated in Profile now use `/signup?ref=...`; existing `/auth?ref=...` links keep working.
- The ₦10 bonus continues to be credited automatically on the referred user's first successful wallet funding.

## 6. Strict 6-digit OTP

- Sign-In, password reset and transaction PIN updates all use 6-digit numeric email codes end to end; no magic-link redirects out of the app. Existing screens are audited and any remaining link-based path is converted.

## Technical notes

- Migration: `admin_profits` (+ GRANTs, RLS restricted to the admin email, service_role full); `is_super_admin()` helper; `complete_vend` and `credit_a2c_settlement` extended to insert the profit row; new `admin_credit_wallet(_user_id, _amount, _reason)` security-definer RPC guarded by the admin email.
- New `src/lib/admin.functions.ts`: `listUsers`, `adminAdjustWallet`, `getProfitSummary` — each verifies `context.claims.email` against the Super Admin before loading the privileged client inside the handler.
- Admin UI: new Users tab and expanded earnings panel in `src/routes/_authenticated/admin.tsx`.
- `useInstallPrompt` exposes `isStandalone` already; `BiometricSetupSheet`, `profile.tsx` biometrics section and `BiometricUnavailableDialog` gate on it.
- New public route `src/routes/signup.tsx` reading `?ref=`, resolving the referrer's display name through a narrow public server function; `ReferralPanel` link updated.
