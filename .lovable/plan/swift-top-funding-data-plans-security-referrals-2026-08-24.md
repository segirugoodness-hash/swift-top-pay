# Swift Top — Funding, Data Plans, Security & Referrals

## 1. Paystack funding email fix
The inline popup is currently opened with only the access code and public key, so Paystack falls back to its own email prompt and can reject the charge.

- Read the signed-in user's email on the client and pass it into the popup config; the server already guarantees a valid email for the initialize call.
- If the account has no email, show a small "Enter your email" step in the funding sheet before opening the popup, and save that address to the account so it is reused next time.
- Keep every network call in try/catch with a toast on failure.

## 2. Multi-network data plans
Verified: the catalogue already holds active plans for MTN, Airtel, Glo and 9mobile — the page is the problem. It opens on the "SME 30-Day" tab, and that tab is only filled when a plan's *name* matches SME/Corporate wording, which mostly happens for MTN. Airtel/Glo/9mobile therefore look empty. Some networks also have no 3-Day rows.

- Filter plans per selected network and group by validity category from the data, not from name keywords.
- Treat any 30-day/monthly plan as an SME/Value plan; keep the badge styling.
- Auto-select the first tab that actually has plans for the selected network, so no network ever opens on an empty tab.
- Tabs with no plans for the current network are hidden instead of showing an empty state.
- Merge the local wholesale cache per network/category (instead of only when the whole catalogue is empty) so gaps like Glo/9mobile 3-Day still render, with live rows always winning.

## 3. Balance check before the PIN modal
- On "Pay", compare the wallet balance against the plan price first; if short, show the "Insufficient balance" toast (with a Fund wallet shortcut) and never open the PIN sheet.
- Apply the same pre-check on Airtime, Data, Cable, Electricity and Education.

## 4. Email OTP everywhere
- Sign-in, forgot password and PIN changes already use 6-digit email codes with a 60s resend timer; audit the three flows for consistent wording, error handling and resend behaviour, and keep the mandatory OTP gate before any PIN overwrite.

## 5. Biometrics + referrals
Biometrics (WebAuthn platform authenticator, Fingerprint/Face ID):
- Profile toggle "Unlock with biometrics"; registers a device credential and stores its handle locally on that device only (no secrets, no server credential store).
- App lock: when enabled, protected views show a lock screen requiring the biometric prompt after the app is reopened or backgrounded.
- Purchase approval: a "Use Face ID / Fingerprint" button appears in the PIN sheet. Because the server always verifies a PIN, enabling biometrics stores the PIN locally in the device's encrypted-at-rest storage, released only after a successful biometric assertion. Users who prefer not to store it can keep using the PIN.

Referrals:
- Profile section shows the user's referral link `/auth?ref=<user_id>` with copy/share and a count of successful referrals plus total earned.
- New table `referrals` (referrer, referred user, status, reward amount) with owner-scoped read access; the signup flow records the ref code.
- Backend rule: the referrer is credited **₦10 once**, the first time the referred user's wallet is funded. Paid automatically from the funding path, guarded so it can never pay twice, and logged as a `referral_bonus` transaction.

## 6. Otapay / crash-proof routing
- Confirm every vend (airtime, data, cable, electricity, education) goes through the server-side vend engine, never a direct call from the browser.
- Any provider timeout or error surfaces as a clean toast and an automatic wallet refund; no frozen buttons.

## Technical notes
- Data page: rework grouping in `src/routes/_authenticated/data.tsx`, extend the category merge in `src/lib/data-plans-cache.ts`.
- Funding: pass `email` into `PaystackPop.setup` in `FundWalletDialog.tsx`; add the email-capture step.
- New `src/hooks/useBiometrics.ts` + `BiometricGate` component; PIN sheet gains a biometric action.
- Migration: `referrals` table with grants and RLS, `referred_by` on `profiles`, and a security-definer credit function called from the funding credit path (Paystack webhook + settlement), idempotent per referred user.
- Balance guard added in each service page before opening `PinDialog`.
