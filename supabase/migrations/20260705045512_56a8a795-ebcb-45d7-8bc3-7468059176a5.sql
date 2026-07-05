CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  UPDATE public.profiles
    SET transaction_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'))
    WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_transaction_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT transaction_pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN false; END IF;
  RETURN h = extensions.crypt(_pin, h);
END;
$$;