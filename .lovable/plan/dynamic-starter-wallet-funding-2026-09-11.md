# Dynamic Starter Wallet Funding

## Goal
Let signed-in Starter users enter an amount, open a Paystack checkout limited to bank transfer or card, and receive an automatic wallet credit after Paystack confirms payment.

## Implementation
- Replace the duplicate funding paths with one authenticated server-side initializer that:
  - validates the amount and signed-in user;
  - reads the active Paystack credentials saved in the Super Admin API Settings;
  - sends the user email, amount in kobo, `bank_transfer` and `card` channels, a unique reference, and the user ID metadata to Paystack;
  - stores the pending funding request and returns only safe checkout fields.
- Keep the existing Paystack popup and authorization-URL redirect fallback. If temporary account creation is unavailable on the Starter tier, open this checkout automatically.
- Harden the public Paystack webhook to:
  - verify the Paystack signature;
  - accept `charge.success` only;
  - verify the reference directly with Paystack before crediting;
  - compare the verified amount and user metadata with the pending request;
  - apply wallet credit, transaction log, event log, request completion, and first-funding referral reward atomically and idempotently.
- Preserve the existing 30-minute funding request expiry and refresh the displayed wallet after checkout/webhook completion.

## Technical notes
- Use TanStack server functions/routes as the project’s secure server boundary rather than adding new Edge Functions. The externally callable webhook remains `/api/public/webhooks/paystack`.
- Continue using the private Paystack configuration already managed by the Super Admin console, avoiding a second source of API credentials.
- Add a database migration for the atomic Paystack settlement routine and required execution permissions.
- Validate compilation, targeted funding behavior, and the public webhook response paths.
