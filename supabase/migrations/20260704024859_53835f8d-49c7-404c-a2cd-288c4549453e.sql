
REVOKE EXECUTE ON FUNCTION public.set_transaction_pin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_transaction_pin(text) TO authenticated;
