# Swift Top: App Download Banner, Biometric Fallback, Funding Fixes

Most of items 2, 4, 5 and 6 of the request already ship in the app (email OTP for sign-in/recovery/PIN change, per-network data categories with Daily/3-Day/Weekly/30-Day tabs, wallet pre-check before the PIN sheet, server-side vend routing with refunds, referral link + automatic ₦10 cashback on the referred user's first funding). This plan covers what is genuinely missing or broken, and verifies the rest.

## 1. App download banner

New `AppDownloadBanner` component, shown at the top of the Home Dashboard and in the Profile screen:
- Title: "Get the Swift Top app"
- Subtitle: "Install the Swift Top mobile app to unlock instant Fingerprint & Face ID login!"
- Primary button "Download App" linking to `/downloads/swift_top.apk`.
- Dismissible on Home (remembered per device); always visible in Profile.

Since no APK is uploaded yet, the button points at that path and, if the file is missing, the tap shows a clean "The Android build is being prepared — check back shortly" toast instead of a broken download.

## 2. Biometric hardware detection & fallback modal

- Registration is already feature-detected; the problem is the error toast. Replace "Could not register your biometrics" with a modal:
  "Biometric login requires the installed mobile application. Please tap 'Download App' to install Swift Top on your phone!" plus the Download App button.
- The same modal replaces the unsupported-device state and any failed/blocked WebAuthn attempt (including inside the browser preview iframe, where platform authenticators are unavailable).
- No behaviour change for devices where registration succeeds.

## 3. Funding fixes

- Bank Transfer tab: stop showing the stuck "Account being assigned" card. When the provider cannot mint a temporary account (Starter tier restriction), the tab immediately falls back to the Paystack checkout popup for that amount, so card / USSD / dynamic transfer works right away. The 30-minute timer and auto-credit polling stay for real assigned accounts.
- Paystack email: keep the current resolution order (session email, then saved profile email, then inline prompt) and confirm the resolved address is in the initialize payload.
- BVN upgrade: on submission, show the inline notice "BVN submitted successfully and stored securely. Your dedicated permanent bank account will be issued upon approval." and keep persisting the details to the profile row.

## 4. Verification pass (no rewrite expected)

Confirm and fix only if broken: OTP flows for sign-in / forgot password / PIN change, data plans rendering for Airtel, Glo and 9mobile across all validity tabs, balance pre-check blocking the PIN sheet, and referral cashback settlement on first funding.

## Technical notes

- New: `src/components/AppDownloadBanner.tsx`, `src/components/BiometricUnavailableDialog.tsx`.
- Edited: `src/routes/_authenticated/index.tsx`, `src/routes/_authenticated/profile.tsx`, `src/components/TempTransferPanel.tsx`, `src/components/FundWalletDialog.tsx`.
- No database migrations required; the funding fallback reuses the existing `initPaystackFunding` server function, so no new external calls or secrets.
