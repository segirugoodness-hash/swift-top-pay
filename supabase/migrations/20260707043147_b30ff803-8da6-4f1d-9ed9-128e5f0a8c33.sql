
REVOKE EXECUTE ON FUNCTION public.try_acquire_service_lock(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_service_lock(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.begin_vend(text, numeric, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_vend(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fail_vend(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_a2c_settlement(uuid, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.change_transaction_pin(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_admin_earnings(numeric, text) FROM PUBLIC;
