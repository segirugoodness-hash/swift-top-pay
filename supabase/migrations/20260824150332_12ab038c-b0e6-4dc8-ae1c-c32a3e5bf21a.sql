REVOKE ALL ON FUNCTION public.settle_referral_reward(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_referral_reward(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.attach_referrer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_referrer(uuid) TO authenticated;