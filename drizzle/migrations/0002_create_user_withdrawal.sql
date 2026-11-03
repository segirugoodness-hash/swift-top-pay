CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _pin text,
  _bank_name text,
  _account_number text,
  _account_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  _balance numeric;
  _txn uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first';
  END IF;

  IF _amount IS NULL OR _amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 100 naira';
  END IF;

  SELECT transaction_pin_hash, wallet_balance
    INTO _hash, _balance
    FROM public.profiles
    WHERE id = _uid
    FOR UPDATE;

  IF _hash IS NULL THEN
    RAISE EXCEPTION 'Set up your transaction PIN first';
  END IF;
  IF extensions.crypt(_pin, _hash) <> _hash THEN
    RAISE EXCEPTION 'Incorrect transaction PIN';
  END IF;

  IF _balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
    SET wallet_balance = wallet_balance - _amount
    WHERE id = _uid AND wallet_balance >= _amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, status, reference, metadata)
  VALUES (
    _uid,
    'withdrawal',
    _amount,
    'pending',
    'stw_' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object(
      'bank', _bank_name,
      'account_number', _account_number,
      'account_name', _account_name
    )
  )
  RETURNING id INTO _txn;

  RETURN _txn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text, text) TO authenticated;

-- Security fix: admin_settings rows must not be readable by every signed-in user.
DROP POLICY IF EXISTS "Anyone signed in can read settings" ON public.admin_settings;
CREATE POLICY "Admins read settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));