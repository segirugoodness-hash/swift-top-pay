
-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Add hashed transaction PIN to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_pin_hash text;

-- 2) RPCs to set / verify PIN
CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  UPDATE public.profiles
    SET transaction_pin_hash = crypt(_pin, gen_salt('bf'))
    WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_transaction_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT transaction_pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN false; END IF;
  RETURN h = crypt(_pin, h);
END;
$$;

-- 3) data_plans table
CREATE TABLE IF NOT EXISTS public.data_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  wholesale_price numeric NOT NULL,
  validity text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_plans TO authenticated;
GRANT ALL ON public.data_plans TO service_role;
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read active data plans"
  ON public.data_plans FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert data plans" ON public.data_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update data plans" ON public.data_plans FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete data plans" ON public.data_plans FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_data_plans_updated BEFORE UPDATE ON public.data_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) network_markups table
CREATE TABLE IF NOT EXISTS public.network_markups (
  network text PRIMARY KEY,
  markup_type text NOT NULL DEFAULT 'flat',
  markup_value numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.network_markups TO authenticated;
GRANT ALL ON public.network_markups TO service_role;
ALTER TABLE public.network_markups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read markups" ON public.network_markups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert markups" ON public.network_markups FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update markups" ON public.network_markups FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Seed markups (flat 0 default)
INSERT INTO public.network_markups (network, markup_type, markup_value) VALUES
  ('mtn','flat',20),('glo','flat',20),('airtel','flat',20),('9mobile','flat',20)
ON CONFLICT (network) DO NOTHING;

-- Seed data_plans matching current defaults across all networks
INSERT INTO public.data_plans (network, category, name, wholesale_price, validity, sort_order) VALUES
  ('mtn','daily','100MB',80,'1 day',1),
  ('mtn','daily','1GB',330,'1 day',2),
  ('mtn','three_day','200MB',180,'3 days',1),
  ('mtn','three_day','2.5GB',580,'3 days',2),
  ('mtn','weekly','750MB',480,'7 days',1),
  ('mtn','weekly','2GB',1180,'7 days',2),
  ('mtn','monthly','4.1GB',1480,'30 days',1),
  ('mtn','monthly','12GB',3480,'30 days',2),
  ('glo','daily','100MB',80,'1 day',1),
  ('glo','daily','1GB',330,'1 day',2),
  ('glo','weekly','2GB',1180,'7 days',1),
  ('glo','monthly','5.8GB',1480,'30 days',1),
  ('airtel','daily','100MB',80,'1 day',1),
  ('airtel','daily','1GB',330,'1 day',2),
  ('airtel','weekly','1.5GB',1180,'7 days',1),
  ('airtel','monthly','6GB',2480,'30 days',1),
  ('9mobile','daily','100MB',80,'1 day',1),
  ('9mobile','weekly','1GB',980,'7 days',1),
  ('9mobile','monthly','4.5GB',1980,'30 days',1)
ON CONFLICT DO NOTHING;

-- 5) Grant admin role to designated email if the user already exists
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'segiruabdulfathi558@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Auto-grant admin on signup for the designated email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NEW.email = 'segiruabdulfathi558@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
