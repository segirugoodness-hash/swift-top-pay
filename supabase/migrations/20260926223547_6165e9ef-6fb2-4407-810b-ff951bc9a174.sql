CREATE TABLE public.referral_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone integer NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone)
);
GRANT SELECT ON public.referral_claims TO authenticated;
GRANT ALL ON public.referral_claims TO service_role;
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral claims" ON public.referral_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_referral_cashback()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _count int; _claimed int; _next int; _total numeric := 0; _reward numeric := 500;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _uid FOR UPDATE;
  SELECT count(*) INTO _count FROM public.referrals WHERE referrer_id = _uid AND status = 'rewarded';
  SELECT COALESCE(max(milestone), 0) INTO _claimed FROM public.referral_claims WHERE user_id = _uid;
  _next := _claimed + 1;
  WHILE _next * 5 <= _count LOOP
    INSERT INTO public.referral_claims (user_id, milestone, amount) VALUES (_uid, _next, _reward);
    _total := _total + _reward;
    _next := _next + 1;
  END LOOP;
  IF _total = 0 THEN RAISE EXCEPTION 'No cashback available yet'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _total WHERE id = _uid;
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
    VALUES (_uid, 'referral_cashback', _total, 'success', jsonb_build_object('milestones', _next - 1 - _claimed), _total);
  RETURN _total;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_referral_cashback() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_referral_cashback() TO authenticated;