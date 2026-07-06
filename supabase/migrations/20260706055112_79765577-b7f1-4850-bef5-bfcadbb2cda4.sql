
-- 1. account tier on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'starter'
    CHECK (account_tier IN ('starter','verified'));

-- 2. system_settings: hard email lock via auth.jwt()
-- Drop any prior permissive policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='system_settings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_settings', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner email full access on system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'segiruabdulfathi558@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'segiruabdulfathi558@gmail.com');

-- Revoke anon so no unauthenticated request ever sees these
REVOKE ALL ON public.system_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- 3. paystack_events for webhook idempotency
CREATE TABLE IF NOT EXISTS public.paystack_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  reference text,
  user_id uuid,
  amount numeric,
  raw jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.paystack_events TO service_role;
ALTER TABLE public.paystack_events ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated => zero access from the client.
