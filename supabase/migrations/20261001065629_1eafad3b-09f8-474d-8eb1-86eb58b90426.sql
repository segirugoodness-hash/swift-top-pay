ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vault_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vault_roundup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vault_roundup_step integer NOT NULL DEFAULT 100;

-- Users must not edit their vault balance directly
CREATE OR REPLACE FUNCTION public.protect_vault_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('swift.vault_write', true) IS DISTINCT FROM 'on'
     AND NEW.vault_balance IS DISTINCT FROM OLD.vault_balance
     AND auth.role() = 'authenticated' THEN
    NEW.vault_balance := OLD.vault_balance;
  END IF;
  IF NEW.vault_roundup_step NOT IN (100, 500) THEN NEW.vault_roundup_step := 100; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_vault ON public.profiles;
CREATE TRIGGER trg_protect_vault BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_vault_balance();

-- Round-up on successful vend
CREATE OR REPLACE FUNCTION public.complete_vend(_txn_id uuid, _provider_ref text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _t record; _profit numeric; _p record; _save numeric := 0;
BEGIN
  SELECT * INTO _t FROM public.transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Txn not found'; END IF;
  IF _t.status <> 'pending' THEN RETURN; END IF;
  _profit := GREATEST(0, COALESCE(_t.amount, 0) - COALESCE(_t.wholesale_price, _t.amount));
  UPDATE public.transactions SET status = 'success',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('provider_ref', _provider_ref)
    WHERE id = _txn_id;
  IF _profit > 0 THEN
    UPDATE public.admin_earnings SET balance = balance + _profit,
      lifetime_revenue = lifetime_revenue + _profit, updated_at = now() WHERE id = 'global';
  END IF;
  INSERT INTO public.admin_profits (user_id, transaction_id, service, reference, charged, cost, margin)
  VALUES (_t.user_id, _t.id, _t.type, COALESCE(_provider_ref, _t.reference),
          COALESCE(_t.amount, 0), COALESCE(_t.wholesale_price, _t.amount), _profit);

  SELECT vault_roundup, vault_roundup_step, wallet_balance INTO _p FROM public.profiles WHERE id = _t.user_id FOR UPDATE;
  IF _p.vault_roundup THEN
    _save := ceil(_t.amount / _p.vault_roundup_step) * _p.vault_roundup_step - _t.amount;
    IF _save > 0 AND _p.wallet_balance >= _save THEN
      PERFORM set_config('swift.vault_write', 'on', true);
      UPDATE public.profiles SET wallet_balance = wallet_balance - _save, vault_balance = vault_balance + _save WHERE id = _t.user_id;
      INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
        VALUES (_t.user_id, 'vault_roundup', _save, 'success', jsonb_build_object('from_txn', _t.id), _save);
    END IF;
  END IF;
END; $function$;

-- Referral rewards go to the vault; auto-pay ₦500 per 5 qualified friends
CREATE OR REPLACE FUNCTION public.settle_referral_reward(_funded_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r record; _reward numeric := 10; _count int; _claimed int; _bonus numeric := 0;
BEGIN
  SELECT * INTO _r FROM public.referrals WHERE referred_id = _funded_user AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.referrals SET status = 'rewarded', reward_amount = _reward, rewarded_at = now() WHERE id = _r.id;
  PERFORM set_config('swift.vault_write', 'on', true);
  UPDATE public.profiles SET vault_balance = vault_balance + _reward WHERE id = _r.referrer_id;
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
    VALUES (_r.referrer_id, 'referral_bonus', _reward, 'success', jsonb_build_object('referred_id', _funded_user, 'to', 'vault'), _reward);

  SELECT count(*) INTO _count FROM public.referrals WHERE referrer_id = _r.referrer_id AND status = 'rewarded';
  SELECT COALESCE(max(milestone), 0) INTO _claimed FROM public.referral_claims WHERE user_id = _r.referrer_id;
  WHILE (_claimed + 1) * 5 <= _count LOOP
    _claimed := _claimed + 1;
    INSERT INTO public.referral_claims (user_id, milestone, amount) VALUES (_r.referrer_id, _claimed, 500);
    _bonus := _bonus + 500;
  END LOOP;
  IF _bonus > 0 THEN
    UPDATE public.profiles SET vault_balance = vault_balance + _bonus WHERE id = _r.referrer_id;
    INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
      VALUES (_r.referrer_id, 'referral_cashback', _bonus, 'success', jsonb_build_object('to', 'vault'), _bonus);
  END IF;
END; $function$;

DROP FUNCTION IF EXISTS public.claim_referral_cashback();

CREATE OR REPLACE FUNCTION public.vault_to_wallet(_amount numeric, _pin text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE _uid uuid := auth.uid(); _p record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT transaction_pin_hash, vault_balance INTO _p FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _p.transaction_pin_hash IS NULL OR _p.transaction_pin_hash <> extensions.crypt(_pin, _p.transaction_pin_hash) THEN
    RAISE EXCEPTION 'Incorrect PIN'; END IF;
  IF _p.vault_balance < _amount THEN RAISE EXCEPTION 'Insufficient vault balance'; END IF;
  PERFORM set_config('swift.vault_write', 'on', true);
  UPDATE public.profiles SET vault_balance = vault_balance - _amount, wallet_balance = wallet_balance + _amount WHERE id = _uid;
  INSERT INTO public.transactions (user_id, type, amount, status, metadata, wholesale_price)
    VALUES (_uid, 'vault_withdrawal', _amount, 'success', '{}'::jsonb, _amount);
  RETURN _amount;
END; $$;
REVOKE EXECUTE ON FUNCTION public.vault_to_wallet(numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.vault_to_wallet(numeric, text) TO authenticated;