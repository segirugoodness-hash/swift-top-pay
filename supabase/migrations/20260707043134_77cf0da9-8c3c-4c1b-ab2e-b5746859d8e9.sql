
-- 1. ADMIN EARNINGS WALLET (single global row)
CREATE TABLE IF NOT EXISTS public.admin_earnings (
  id text PRIMARY KEY DEFAULT 'global',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_revenue numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_earnings_singleton CHECK (id = 'global')
);
GRANT SELECT ON public.admin_earnings TO authenticated;
GRANT ALL ON public.admin_earnings TO service_role;
ALTER TABLE public.admin_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only owner can view earnings" ON public.admin_earnings
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'segiruabdulfathi558@gmail.com');
INSERT INTO public.admin_earnings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 2. ANTI-DUPLICATE SERVICE LOCKS (45s TTL)
CREATE TABLE IF NOT EXISTS public.service_locks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 seconds'),
  PRIMARY KEY (user_id, service_type)
);
GRANT SELECT, DELETE ON public.service_locks TO authenticated;
GRANT ALL ON public.service_locks TO service_role;
ALTER TABLE public.service_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own locks" ON public.service_locks FOR SELECT USING (auth.uid() = user_id);

-- 3. TRANSACTION LEDGER UPGRADE
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS wholesale_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS error_message text;

-- 4. ATOMIC VEND ENGINE
CREATE OR REPLACE FUNCTION public.try_acquire_service_lock(_service_type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  -- purge expired locks for this user/service first
  DELETE FROM public.service_locks
    WHERE user_id = auth.uid() AND service_type = _service_type AND expires_at < now();
  BEGIN
    INSERT INTO public.service_locks (user_id, service_type) VALUES (auth.uid(), _service_type);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN RETURN false; END;
END; $$;

CREATE OR REPLACE FUNCTION public.release_service_lock(_service_type text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.service_locks WHERE user_id = auth.uid() AND service_type = _service_type;
$$;

CREATE OR REPLACE FUNCTION public.begin_vend(
  _type text, _retail numeric, _wholesale numeric, _pin text, _reference text, _metadata jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  _bal numeric;
  _txn_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _retail <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _wholesale IS NULL OR _wholesale < 0 THEN _wholesale := _retail; END IF;

  -- Verify PIN
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _hash IS NULL THEN RAISE EXCEPTION 'PIN not set'; END IF;
  IF _hash <> extensions.crypt(_pin, _hash) THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;

  -- Lock balance row & check
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _retail THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Deduct
  UPDATE public.profiles SET wallet_balance = wallet_balance - _retail WHERE id = _uid;

  -- Ledger row (pending)
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price, reference)
    VALUES (_uid, _type, _retail, 'pending', COALESCE(_metadata, '{}'::jsonb), _wholesale, _reference)
    RETURNING id INTO _txn_id;
  RETURN _txn_id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_vend(_txn_id uuid, _provider_ref text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t record; _profit numeric;
BEGIN
  SELECT * INTO _t FROM public.transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Txn not found'; END IF;
  IF _t.status <> 'pending' THEN RETURN; END IF;
  _profit := GREATEST(0, COALESCE(_t.amount, 0) - COALESCE(_t.wholesale_price, _t.amount));
  UPDATE public.transactions SET status = 'success',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('provider_ref', _provider_ref)
    WHERE id = _txn_id;
  IF _profit > 0 THEN
    UPDATE public.admin_earnings
       SET balance = balance + _profit,
           lifetime_revenue = lifetime_revenue + _profit,
           updated_at = now()
     WHERE id = 'global';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.fail_vend(_txn_id uuid, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t record;
BEGIN
  SELECT * INTO _t FROM public.transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Txn not found'; END IF;
  IF _t.status <> 'pending' THEN RETURN; END IF;
  -- refund wallet
  UPDATE public.profiles SET wallet_balance = wallet_balance + _t.amount WHERE id = _t.user_id;
  UPDATE public.transactions SET status = 'failed', error_message = _error WHERE id = _txn_id;
END; $$;

-- 5. A2C SETTLEMENT (80% user, 5% admin — 15% remainder is otapay wholesale discount margin retained by provider)
CREATE OR REPLACE FUNCTION public.credit_a2c_settlement(
  _user_id uuid, _airtime_amount numeric, _reference text, _metadata jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_cut numeric := round(_airtime_amount * 0.80, 2);
  _admin_cut numeric := round(_airtime_amount * 0.05, 2);
BEGIN
  -- idempotency: skip if reference already booked
  IF EXISTS (SELECT 1 FROM public.transactions WHERE reference = _reference) THEN RETURN; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _user_cut WHERE id = _user_id;
  UPDATE public.admin_earnings SET balance = balance + _admin_cut,
    lifetime_revenue = lifetime_revenue + _admin_cut, updated_at = now() WHERE id = 'global';
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price, reference)
    VALUES (_user_id, 'airtime_to_cash', _user_cut, 'success',
            COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('admin_cut', _admin_cut, 'airtime_amount', _airtime_amount),
            _user_cut, _reference);
END; $$;

-- 6. CHANGE TRANSACTION PIN
CREATE OR REPLACE FUNCTION public.change_transaction_pin(_current text, _new text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _hash text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _new !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'New PIN must be exactly 4 digits'; END IF;
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE id = auth.uid();
  IF _hash IS NULL THEN RAISE EXCEPTION 'No PIN set'; END IF;
  IF _hash <> extensions.crypt(_current, _hash) THEN RAISE EXCEPTION 'Current PIN is incorrect'; END IF;
  UPDATE public.profiles
     SET transaction_pin_hash = extensions.crypt(_new, extensions.gen_salt('bf'))
   WHERE id = auth.uid();
END; $$;

-- 7. Admin can debit earnings via RPC (for withdrawals)
CREATE OR REPLACE FUNCTION public.debit_admin_earnings(_amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal numeric;
BEGIN
  IF (auth.jwt() ->> 'email') <> 'segiruabdulfathi558@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT balance INTO _bal FROM public.admin_earnings WHERE id = 'global' FOR UPDATE;
  IF _bal < _amount THEN RAISE EXCEPTION 'Insufficient earnings balance'; END IF;
  UPDATE public.admin_earnings SET balance = balance - _amount, updated_at = now() WHERE id = 'global';
  INSERT INTO public.transactions (user_id, type, amount, status, metadata)
    VALUES (auth.uid(), 'admin_withdrawal', _amount, 'success', jsonb_build_object('note', _note));
END; $$;

GRANT EXECUTE ON FUNCTION public.try_acquire_service_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_service_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_vend(text, numeric, numeric, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_vend(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_vend(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_a2c_settlement(uuid, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_transaction_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_admin_earnings(numeric, text) TO authenticated;
