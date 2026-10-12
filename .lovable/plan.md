
# Swift Top — Phase 1 Plan

A mobile-first fintech dashboard with a dark navy theme, teal/emerald accents, and six service sub-pages. Backend will use **Lovable Cloud** (managed Supabase) so no manual env vars are needed — the Supabase client, URL, and keys are wired automatically.

## 1. Design system (`src/styles.css`)

- Dark navy background tokens (base, elevated card, subtle border)
- Teal + emerald accent tokens for active wallet header, CTA highlights
- Muted foreground for secondary text; success/warning/destructive semantic tokens
- Rounded-2xl cards, soft glow shadow token for the wallet header
- Fonts: Space Grotesk (headings) + Inter (body) via `<link>` in `__root.tsx`
- Update `__root.tsx` head with real title/description: "Swift Top — Airtime, Data & Bills"

## 2. Routes (TanStack file-based, all mobile-first)

```
src/routes/
  index.tsx                 Dashboard (wallet header + 6 service cards)
  airtime.tsx               Network picker + phone + amount
  data.tsx                  Network + tabs (Daily / Weekly / Monthly)
  electricity.tsx           Disco dropdown + meter number + amount
  cable.tsx                 Provider (DSTV/GOTV/StarTimes) + smartcard + package
  education.tsx             Exam (WAEC/NECO/JAMB) + quantity
  airtime-to-cash.tsx       Sender number + network + amount + bank + account
```

Each sub-page has a sticky top bar with a "← Back to Dashboard" `<Link to="/">` button, a title, and a form built with shadcn (Input, Select, Tabs, Button, RadioGroup). Forms validate with zod + react-hook-form and show a toast on submit (no real transaction yet in Phase 1).

## 3. Dashboard composition (`index.tsx`)

- Header: greeting + placeholder phone `08012345678`, small avatar circle
- Wallet balance card: gradient teal→emerald, big balance (₦0.00 placeholder), Fund / Withdraw pills
- Quick actions grid (2 cols on mobile): 6 touch-friendly cards with icon + label routing to each service
- Recent transactions section (empty state for Phase 1)
- Bottom nav bar (Home / History / Profile) — Home active

## 4. Shared components

- `src/components/ServiceCard.tsx` — icon + label tile
- `src/components/PageHeader.tsx` — back button + title used by all sub-pages
- `src/components/WalletCard.tsx` — gradient balance card
- `src/components/BottomNav.tsx` — fixed bottom nav
- Network / Disco / Cable option data in `src/lib/vtu-options.ts`

## 5. Backend preparation (Lovable Cloud)

- Enable Lovable Cloud (managed Supabase). This auto-generates `src/integrations/supabase/client.ts` and wires `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — no manual env setup needed.
- No tables created in Phase 1 (per scope: "prepare configuration"). Client is imported and ready so Phase 2 can add `wallets`, `transactions`, `profiles` tables.
- Note for the user: Lovable Cloud is Supabase under the hood; the standard `SUPABASE_URL` / `SUPABASE_ANON_KEY` are provisioned automatically and accessible to the app.

## Technical notes

- Icons: lucide-react (Phone, Wifi, Zap, Tv, GraduationCap, ArrowLeftRight)
- All colors via semantic tokens — no hardcoded hex in components
- Viewport: designed at 390×844; single column, 16px gutters, 44px min tap targets
- No auth in Phase 1 (forms are visual + toast confirmation)

## Out of scope (Phase 2+)

- Real VTU provider integration, wallet funding, auth, transaction history persistence, KYC
