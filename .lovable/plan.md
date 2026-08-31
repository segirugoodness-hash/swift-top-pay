# Installable Swift Top + Biometric Quick Sign-In

Two goals: make Swift Top installable to the phone home screen (no APK, no offline caching), and offer Fingerprint / Face ID quick sign-in right after the user's first OTP sign-in.

The 6-digit OTP screens for Sign In, Forgot Password, and PIN change already exist and stay as they are — the only change on that side is confirming the emails deliver a numeric code.

## 1. Installable app (Add to Home Screen)

- Add a web app manifest with Swift Top's name, teal/navy theme colors, standalone display, and icon set (192, 512, maskable, plus an Apple touch icon). Icons generated from the existing Swift Top mark.
- Register the manifest, theme-color, and apple-touch-icon tags in the app's shared head.
- No service worker and no offline mode.

## 2. "Add to Home Screen" banner replaces the APK

- The existing banner on the Dashboard and Profile keeps its look, but the button becomes **Add to Home Screen**:
  - Android / Chrome: fires the native install prompt.
  - iOS Safari: opens a short sheet showing "Share → Add to Home Screen" with the steps.
  - Already installed (standalone): the banner hides itself.
- The `/downloads/swift_top.apk` link and its "build is being prepared" message are removed.
- Subtitle updates to reflect installing the app for instant Fingerprint & Face ID login.

## 3. Biometric quick sign-in after OTP

- After a successful OTP sign-in or signup verification, show a one-time sheet: "Enable Fingerprint / Face ID for faster sign-in?" with Enable and "Not now" options. It never blocks navigation and is only ever offered once per device.
- Enrolling calls the existing WebAuthn registration. When the device or browser can't do it (e.g. the Lovable preview window), the existing "install the app" dialog appears instead of an error toast — matching the current Profile behaviour.
- The existing app lock and PIN-approval biometric paths are unchanged; enrollment simply happens earlier.

## 4. OTP emails

- Verify the auth email templates send a numeric `{{ .Token }}` code rather than a magic link, and adjust the template if it still sends a link. No code changes in the app for this.

## Technical notes

- `public/manifest.webmanifest` + generated icons under `public/`; tags added in `src/routes/__root.tsx`.
- `src/hooks/useInstallPrompt.ts`: captures `beforeinstallprompt`, exposes `canInstall`, `isStandalone`, `isIOS`, and `promptInstall()`.
- `src/components/AppDownloadBanner.tsx` rewired to that hook; `APK_URL` / `downloadApp()` removed and its one other usage updated.
- `src/components/BiometricSetupSheet.tsx`: new post-sign-in enrollment sheet, gated by a `localStorage` "asked" flag plus `useBiometrics().supported/enabled`, mounted where the authenticated shell already mounts `BiometricLock`.
- `src/routes/auth.tsx` sets the "offer enrollment" flag on successful `verifyOtp` and password sign-in; the sheet reads it after redirect so the auth screen isn't blocked.
- No service worker, no `vite-plugin-pwa`, per the installable-only scope.
