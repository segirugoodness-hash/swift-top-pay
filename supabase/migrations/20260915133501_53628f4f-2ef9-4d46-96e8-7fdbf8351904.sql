CREATE TABLE public.user_passkeys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone
);

CREATE INDEX user_passkeys_user_id_idx ON public.user_passkeys (user_id);

GRANT SELECT, DELETE ON public.user_passkeys TO authenticated;
GRANT ALL ON public.user_passkeys TO service_role;

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys" ON public.user_passkeys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own passkeys" ON public.user_passkeys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.passkey_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  purpose text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX passkey_challenges_expires_idx ON public.passkey_challenges (expires_at);

GRANT ALL ON public.passkey_challenges TO service_role;

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;