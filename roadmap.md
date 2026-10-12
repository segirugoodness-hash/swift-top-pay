# Swift Top roadmap

- [x] Passkey (Fingerprint / Face ID) sign-in: table, server verification, enrol + login UI
      (verified end to end: enrol on Profile, then "Login with Biometrics" signs in)
- [x] Brevo email sending: gateway-backed helper in src/lib/email.server.ts, purchase receipts
      sent after every successful vend
- [x] Offline purchase queue with auto-retry (src/lib/offline-queue.ts + OfflineQueueChip)
- [x] Installable app shell / service worker + 48px tap targets
- [x] Otapay routing completeness: airtime, data, cable, electricity and education all call
      Otapay through the vend engine with explicit payloads; bills carry the ₦100 service fee
      so admin_profits records a non-zero margin.

## Needs the account owner
- Auth code emails (sign-in / reset codes) still send through the built-in mail service.
  To route those through Brevo too, the Brevo SMTP host, login and key must be entered in
  the project's email settings — that part cannot be automated here.
