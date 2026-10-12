ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount numeric NOT NULL DEFAULT 0,
  rewarded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view referrals they are part of"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE TRIGGER trg_referrals_updated
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Records the referral link at signup; safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.attach_referrer(_referrer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR _referrer IS NULL OR _referrer = _uid THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _referrer) THEN RETURN; END IF;
  UPDATE public.profiles SET referred_by = _referrer WHERE id = _uid AND referred_by IS NULL;
  INSERT INTO public.referrals (referrer_id, referred_id, status)
    VALUES (_referrer, _uid, 'pending')
    ON CONFLICT (referred_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.attach_referrer(uuid) TO authenticated;

-- Credits the referrer 10 NGN once, the first time the referred user funds their wallet.
CREATE OR REPLACE FUNCTION public.settle_referral_reward(_funded_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r record; _reward numeric := 10;
BEGIN
  SELECT * INTO _r FROM public.referrals
    WHERE referred_id = _funded_user AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.referrals
     SET status = 'rewarded', reward_amount = _reward, rewarded_at = now()
   WHERE id = _r.id;

  UPDATE public.profiles SET wallet_balance = wallet_balance + _reward WHERE id = _r.referrer_id;

  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
    VALUES (_r.referrer_id, 'referral_bonus', _reward, 'success',
            jsonb_build_object('referred_id', _funded_user), _reward);
END; $$;