CREATE OR REPLACE FUNCTION public.set_biometric_transactions_enabled(_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _enabled AND NOT EXISTS (
    SELECT 1 FROM public.user_passkeys WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Register a passkey before enabling payment confirmation';
  END IF;
  PERFORM set_config('swift.biometric_write', 'on', true);
  UPDATE public.profiles
     SET biometric_transactions_enabled = _enabled
   WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_biometric_transactions_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_biometric_transactions_enabled(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.begin_vend_authorized(
  _user_id uuid,
  _type text,
  _retail numeric,
  _wholesale numeric,
  _pin text,
  _reference text,
  _metadata jsonb,
  _biometric_challenge_id uuid,
  _intent_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _profile record;
  _txn_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _type NOT IN ('airtime', 'data', 'electricity', 'cable', 'education') THEN
    RAISE EXCEPTION 'Unsupported service';
  END IF;
  IF _retail IS NULL OR _retail <= 0 OR _wholesale IS NULL OR _wholesale < 0 OR _wholesale > _retail THEN
    RAISE EXCEPTION 'Invalid transaction price';
  END IF;
  IF _reference IS NULL OR length(_reference) > 120 THEN RAISE EXCEPTION 'Invalid reference'; END IF;

  SELECT transaction_pin_hash, wallet_balance, biometric_transactions_enabled
    INTO _profile
    FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _profile.transaction_pin_hash IS NULL THEN RAISE EXCEPTION 'PIN not set'; END IF;
  IF _profile.transaction_pin_hash <> extensions.crypt(_pin, _profile.transaction_pin_hash) THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;
  IF _profile.biometric_transactions_enabled THEN
    IF _biometric_challenge_id IS NULL OR _intent_hash IS NULL THEN
      RAISE EXCEPTION 'Confirm this payment with your device biometric';
    END IF;
    PERFORM 1 FROM public.passkey_challenges
      WHERE id = _biometric_challenge_id
        AND user_id = _user_id
        AND purpose = 'payment'
        AND intent_hash = _intent_hash
        AND consumed_at IS NOT NULL
        AND used_at IS NULL
        AND expires_at > now()
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Biometric approval is missing, expired, or for another payment'; END IF;
    UPDATE public.passkey_challenges SET used_at = now()
      WHERE id = _biometric_challenge_id AND used_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Biometric approval was already used'; END IF;
  ELSIF _biometric_challenge_id IS NOT NULL OR _intent_hash IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected biometric approval';
  END IF;

  IF _profile.wallet_balance < _retail THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _retail WHERE id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price, reference)
    VALUES (_user_id, _type, _retail, 'pending', COALESCE(_metadata, '{}'::jsonb), _wholesale, _reference)
    RETURNING id INTO _txn_id;
  RETURN _txn_id;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_vend_authorized(uuid, text, numeric, numeric, text, text, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_vend_authorized(uuid, text, numeric, numeric, text, text, jsonb, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.begin_vend(text, numeric, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_vend(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_vend(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_vend(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_vend(uuid, text) TO service_role;