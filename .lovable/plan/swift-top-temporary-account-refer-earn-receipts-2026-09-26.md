# Swift Top: temporary account, Refer & Earn, receipts

Most of this brief is already built. This plan covers the parts that are still missing and names what stays as it is.

## Already built (small copy changes only)
- 6-digit code screens for sign-up, forgotten password and PIN change, each with a 60-second "Resend OTP" timer.
- Airtime and Data buys go through the secure server layer. That layer sends the order to Otapay, checks the wholesale cost against your retail price, and records the profit in your admin ledger.
- The install banner works on Android (the browser's own install prompt) and on iOS (Share → Add to Home Screen steps).
- Fingerprint / Face ID sign-in, including a "Login with Biometrics" button on the sign-in page.
- A 4-digit PIN is required before every purchase and withdrawal.

## New work
1. **After the BVN upgrade**: once the user submits their BVN, show the reassurance message exactly as you wrote it. The app then creates or reuses a temporary funding account.
2. **Temporary account card under the wallet balance**: shows the bank name, account number, a "Copy Account Number" button and a live countdown. It disappears when the account expires, and the wallet refreshes when a deposit arrives.
3. **Checkout details**: the PIN step for Airtime and Data shows a summary of the package first (network, plan, validity, number, price) before the user confirms.
4. **Security toggle**: the Profile page gets one switch, "Enable Face ID / Fingerprint Login". Turning it on registers this device. Turning it off removes it.
5. **Refer & Earn screen** (a new page, linked from the dashboard and Profile):
   - The user's referral link with a copy button and a share button.
   - A progress bar showing "X / 5 Friends Joined". A friend counts once they have signed up and funded their wallet or made a purchase.
   - At 5 friends, a "Claim Cashback" button unlocks. It pays the reward into the wallet once per set of 5 friends. The server checks everything, so the reward can't be claimed twice.
6. **Receipts in History**: each transaction gets a "View Receipt" button. It opens a clean receipt showing the reference ID, date, service, amount and status. The receipt has **Share** (the phone's share menu) and **Download** (saves as an image).

## Question for you
- The reward amount for 5 friends isn't specified. I'll use **₦500** unless you tell me otherwise. The current ₦10 bonus per friend will stay.

## Technical details
- The requested `/paystack-temporary-account` and `/otapay-purchase` edge functions will be built as TanStack server functions instead, following the project's rule of no Supabase Edge Functions. Temporary accounts reuse the existing funding server helpers (`funding.functions.ts`, stored in `funding_requests`). Purchases keep using `vend.functions.ts` → `begin_vend` / `complete_vend` → `admin_profits`.
- Migration: add a `referral_claims` table (user_id, milestone, amount, created_at) with grants and RLS for reading your own rows only. Add a `claim_referral_cashback()` security-definer RPC that counts rewarded referrals, works out which milestones haven't been claimed yet, credits the wallet and logs a `referral_cashback` transaction, all atomically.
- The receipt image is rendered from a canvas, with no new PDF library (PDF receipts were declined earlier). Sharing uses `navigator.share` with a file where the phone supports it, and falls back to a download.
- Head metadata will be added to the new `/refer` route.
