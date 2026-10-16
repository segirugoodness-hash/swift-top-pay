ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biometric_transactions_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.passkey_challenges ADD COLUMN IF NOT EXISTS intent_hash text;
ALTER TABLE public.passkey_challenges ADD COLUMN IF NOT EXISTS used_at timestamptz;
COMMENT ON COLUMN public.profiles.biometric_transactions_enabled IS 'Server-managed requirement for passkey confirmation on wallet purchases.';
COMMENT ON COLUMN public.passkey_challenges.intent_hash IS 'Canonical transaction intent this one-time passkey challenge authorizes.';
COMMENT ON COLUMN public.passkey_challenges.used_at IS 'Timestamp when an approval challenge was attached to a wallet transaction.';
CREATE OR REPLACE FUNCTION public.protect_biometric_transaction_flag()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('swift.biometric_write', true) IS DISTINCT FROM 'on'
     AND NEW.biometric_transactions_enabled IS DISTINCT FROM OLD.biometric_transactions_enabled
     AND auth.role() = 'authenticated' THEN
    NEW.biometric_transactions_enabled := OLD.biometric_transactions_enabled;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_biometric_transaction_flag ON public.profiles;
CREATE TRIGGER trg_protect_biometric_transaction_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_biometric_transaction_flag();