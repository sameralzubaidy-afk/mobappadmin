-- ================================================================
-- DIAGNOSTIC SCRIPT: Debug Seller Balance Trigger Issue
-- ================================================================

-- STEP 1: Verify trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'trades'::regclass 
AND tgname = 'trigger_update_seller_balance_on_completion';

-- Expected: Should show trigger with tgenabled = 't'
-- If missing: Run migration 074 again
-- If disabled: Run: ALTER TABLE trades ENABLE TRIGGER trigger_update_seller_balance_on_completion;


-- STEP 2: Verify trigger function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'update_seller_balance_on_trade_completion';

-- Expected: Should show the function


-- STEP 3: Check if seller_balance table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'seller_balance';

-- Expected: Should show 'seller_balance'


-- STEP 4: Verify RLS is enabled on seller_balance
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'seller_balance';

-- Expected: relrowsecurity = true


-- STEP 5: Check RLS policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'seller_balance' 
ORDER BY policyname;

-- Expected: Should show INSERT, UPDATE, SELECT policies


-- STEP 6: Check if seller_balance records exist
SELECT user_id, available_balance_cents, lifetime_earnings_cents, total_trades_completed 
FROM seller_balance 
ORDER BY created_at DESC 
LIMIT 5;

-- Expected: Should show completed trade amounts in available_balance_cents


-- STEP 7: Find recently completed trades
SELECT id, seller_id, status, cash_amount_cents, completed_at 
FROM trades 
WHERE status = 'completed' 
ORDER BY completed_at DESC 
LIMIT 5;

-- Expected: Should show recent completed trades


-- STEP 8: Cross-check - for each completed trade, verify balance was updated
-- Replace <seller_id> and <cash_amount_cents> with values from Step 7
SELECT 
  t.id as trade_id,
  t.seller_id,
  t.cash_amount_cents,
  sb.available_balance_cents,
  CASE 
    WHEN sb.available_balance_cents >= t.cash_amount_cents THEN '✅ Balance includes trade amount'
    ELSE '❌ Balance missing this trade amount'
  END as status
FROM trades t
LEFT JOIN seller_balance sb ON sb.user_id = t.seller_id
WHERE t.status = 'completed'
ORDER BY t.completed_at DESC
LIMIT 10;

-- This will show if seller_balance is being updated with completed trade amounts


-- STEP 9: Test trigger manually by checking recent seller_balance updates
SELECT 
  user_id, 
  available_balance_cents, 
  updated_at 
FROM seller_balance 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- Expected: Should show recent updates from completed trades


-- STEP 10: If trigger is not firing, manually test it
-- First, get a seller_id and trade_id from recent completed trades
-- Then run this to verify the calculation would be correct:
-- SELECT 
--   t.seller_id,
--   i.price * 100 as item_price_cents,
--   t.sp_amount,
--   (i.price * 100)::INTEGER - (COALESCE(t.sp_amount, 0) * 100) as expected_seller_proceeds
-- FROM trades t
-- JOIN items i ON i.id = t.listing_id
-- WHERE t.status = 'completed'
-- ORDER BY t.completed_at DESC
-- LIMIT 1;

-- ================================================================
-- STEP 11: If trigger is not working, try re-enabling it
-- ================================================================

-- Check if trigger is disabled
ALTER TABLE trades ENABLE TRIGGER trigger_update_seller_balance_on_completion;

-- Then run a completed trade and check if balance updates


-- ================================================================
-- STEP 12: Force update seller_balance for existing completed trades
-- (Run only if trigger fix doesn't work)
-- ================================================================

-- CAUTION: This recalculates balances - run with care!

-- INSERT INTO seller_balance (user_id, available_balance_cents, lifetime_earnings_cents, total_trades_completed, created_at, updated_at)
-- SELECT 
--   t.seller_id,
--   COALESCE(SUM((i.price * 100)::INTEGER - (COALESCE(t.sp_amount, 0) * 100)), 0) as available_balance_cents,
--   COALESCE(SUM((i.price * 100)::INTEGER - (COALESCE(t.sp_amount, 0) * 100)), 0) as lifetime_earnings_cents,
--   COUNT(*) as total_trades_completed,
--   NOW(),
--   NOW()
-- FROM trades t
-- JOIN items i ON i.id = t.listing_id
-- WHERE t.status = 'completed'
-- GROUP BY t.seller_id
-- ON CONFLICT (user_id) DO UPDATE SET
--   available_balance_cents = EXCLUDED.available_balance_cents,
--   lifetime_earnings_cents = EXCLUDED.lifetime_earnings_cents,
--   total_trades_completed = EXCLUDED.total_trades_completed,
--   updated_at = NOW();

-- ================================================================
-- EXPECTED RESULT
-- ================================================================

-- After running migration 074 fix + re-testing:
-- 1. Trigger should exist and be ENABLED
-- 2. When trade status updates to 'completed', trigger fires
-- 3. seller_balance.available_balance_cents increases by cash_amount_cents
-- 4. Seller sees amount in "Available to Withdraw"
