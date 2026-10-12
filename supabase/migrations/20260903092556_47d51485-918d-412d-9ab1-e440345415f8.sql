CREATE TABLE public.admin_profits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  transaction_id uuid,
  service text NOT NULL,
  reference text,
  charged numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_profits TO authenticated;
GRANT ALL ON public.admin_profits TO service_role;

ALTER TABLE public.admin_profits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owner can view profits" ON public.admin_profits
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'segiruabdulfathi558@gmail.com');

CREATE INDEX idx_admin_profits_created_at ON public.admin_profits (created_at DESC);
CREATE INDEX idx_admin_profits_service ON public.admin_profits (service);

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = 'segiruabdulfathi558@gmail.com'
$$;

-- complete_vend now logs a per-transaction profit row
CREATE OR REPLACE FUNCTION public.complete_vend(_txn_id uuid, _provider_ref text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  INSERT INTO public.admin_profits (user_id, transaction_id, service, reference, charged, cost, margin)
  VALUES (_t.user_id, _t.id, _t.type, COALESCE(_provider_ref, _t.reference),
          COALESCE(_t.amount, 0), COALESCE(_t.wholesale_price, _t.amount), _profit);
END; $function$;

-- A2C settlement now logs the admin cut as a profit row
CREATE OR REPLACE FUNCTION public.credit_a2c_settlement(_user_id uuid, _airtime_amount numeric, _reference text, _metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_cut numeric := round(_airtime_amount * 0.80, 2);
  _admin_cut numeric := round(_airtime_amount * 0.05, 2);
  _txn_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.transactions WHERE reference = _reference) THEN RETURN; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _user_cut WHERE id = _user_id;
  UPDATE public.admin_earnings SET balance = balance + _admin_cut,
    lifetime_revenue = lifetime_revenue + _admin_cut, updated_at = now() WHERE id = 'global';
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price, reference)
    VALUES (_user_id, 'airtime_to_cash', _user_cut, 'success',
            COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('admin_cut', _admin_cut, 'airtime_amount', _airtime_amount),
            _user_cut, _reference)
    RETURNING id INTO _txn_id;
  INSERT INTO public.admin_profits (user_id, transaction_id, service, reference, charged, cost, margin)
    VALUES (_user_id, _txn_id, 'airtime_to_cash', _reference, _airtime_amount, _airtime_amount - _admin_cut, _admin_cut);
END; $function$;

-- Super Admin manual wallet adjustment
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_user_id uuid, _amount numeric, _reason text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _bal numeric;
BEGIN
  IF (auth.jwt() ->> 'email') <> 'segiruabdulfathi558@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Amount must be non-zero'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _bal + _amount < 0 THEN RAISE EXCEPTION 'Insufficient user balance'; END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + _amount WHERE id = _user_id
    RETURNING wallet_balance INTO _bal;

  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
  VALUES (_user_id,
          CASE WHEN _amount > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          abs(_amount), 'success',
          jsonb_build_object('reason', _reason, 'by', auth.jwt() ->> 'email'),
          abs(_amount));

  RETURN _bal;
END; $function$;