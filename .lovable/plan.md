# Swift Top utility payment updates

## Goal
Harden the existing sign-in and admin paths, remove any actual user-to-user transfers, and extend database-driven pricing without disrupting the current mobile dashboard.

## Work
1. Keep authentication on the project's connected Supabase client, retain the existing numeric OTP sign-up, sign-in, and recovery paths, and harden async loading/error handling.
2. Audit navigation and utility pages for P2P transfers; remove only user-to-user transfer features, not bill payments or airtime-to-cash.
3. Add an RLS-protected Otapay wholesale catalog and use a database-backed global percentage markup for dynamically priced utilities; add owner-only catalog controls to the admin console.
4. Preserve the existing four utility tiles and Paystack wallet funding card; strengthen the `/admin` email gate and verify history remains read-only for users.
5. Validate type/build output, error telemetry, and the key public/authenticated UI states.

## Technical details
- Leave generated Supabase client and preview-auth storage files untouched. The preview broker shares session storage; Supabase API calls still target the configured project URL.
- Add the catalog with explicit Data API grants, authenticated reads, owner-email-only writes, and service-role access.
- Reuse `network_markups` for the global percentage row and existing `data_plans` for data bundle wholesale costs; retain existing configured local markups as fallback where no global rate exists.
- Add focused tests for global percentage calculations.
