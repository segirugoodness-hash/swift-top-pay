CREATE OR REPLACE FUNCTION public.settle_paystack_funding(
  _event_id text,
  _reference text,
  _user_id uuid,
  _amount numeric,
  _raw jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _request public.funding_requests%ROWTYPE;
BEGIN
  IF _event_id IS NULL OR btrim(_event_id) = '' THEN
    RAISE EXCEPTION 'Missing Paystack event ID';
  END IF;
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'Missing Paystack reference';
  END IF;
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid funding details';
  END IF;

  IF EXISTS (SELECT 1 FROM public.paystack_events WHERE event_id = _event_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO _request
  FROM public.funding_requests
  WHERE account_name = _reference
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funding request not found';
  END IF;
  IF _request.status IN ('completed', 'success') THEN
    RETURN false;
  END IF;
  IF _request.status <> 'pending' THEN
    RAISE EXCEPTION 'Funding request is not pending';
  END IF;
  IF round(_request.amount, 2) <> round(_amount, 2) THEN
    RAISE EXCEPTION 'Funding amount mismatch';
  END IF;

  INSERT INTO public.paystack_events (event_id, event_type, reference, user_id, amount, raw)
  VALUES (_event_id, 'charge.success', _reference, _user_id, _amount, COALESCE(_raw, '{}'::jsonb));

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + _amount
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, status, reference, metadata, wholesale_price)
  VALUES (
    _user_id,
    'wallet_funding',
    _amount,
    'success',
    _reference,
    jsonb_build_object('source', 'paystack', 'event', 'charge.success'),
    _amount
  );

  UPDATE public.funding_requests
  SET status = 'completed'
  WHERE id = _request.id;

  PERFORM public.settle_referral_reward(_user_id);
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_paystack_funding(text, text, uuid, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_paystack_funding(text, text, uuid, numeric, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.settle_paystack_funding(text, text, uuid, numeric, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paystack_funding(text, text, uuid, numeric, jsonb) TO service_role;