-- Temporarily pause XP-to-Pro reward claims at the database permission layer.
-- The application UI and HTTP endpoints are also disabled by
-- src/lib/payments/feature.ts. This closes direct Supabase RPC calls as well.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.claim_xp_reward(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.claim_xp_reward(text) IS
  'Temporarily paused. To re-enable SmartNekam Pro XP rewards, intentionally restore EXECUTE for authenticated and set SMARTNEKAM_PAYMENTS_ENABLED to true in src/lib/payments/feature.ts.';

COMMIT;
