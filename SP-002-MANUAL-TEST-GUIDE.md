# SP-002 Manual Testing Guide
## MODULE-09: Swap Points Earning Logic

**Version:** 1.0  
**Date:** January 19, 2026  
**Tester:** _______________  
**Environment:** Production Supabase

---

## Prerequisites

### 1. Database Setup
✅ Run this SQL in Supabase SQL Editor:

```sql
-- Step 1: Verify migration applied
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('sp_wallets', 'sp_batches', 'sp_ledger', 'sp_config');
-- Expected: 4 tables found

-- Step 2: Verify RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'issue_starter_pack',
  'award_referral_sp',
  'award_challenge_sp',
  'refund_sp_for_cancelled_trade',
  'is_active_subscriber'
);
-- Expected: 5 functions found

-- Step 3: Verify SP config values
SELECT config_key, config_value FROM sp_config 
WHERE config_key IN (
  'starter_pack_amount',
  'referral_reward_referrer_sp',
  'referral_reward_referee_sp',
  'expiration_period_days'
);
-- Expected: 4 config values found
```

### 2. Test Users Setup
You need 3 test users:
- **User A:** Active Kids Club+ subscriber (tester@test.com)
- **User B:** Active Kids Club+ subscriber (referrer@test.com)
- **User C:** Active Kids Club+ subscriber (referee@test.com)

### 3. Mobile App Setup
✅ Build and install app:
```bash
cd p2p-kids-marketplace
npm install
npm run ios  # or npm run android
```

---

## Test Suite 1: Starter Pack Earning

### TC-SP-002-001: Issue Starter Pack (Happy Path)

**Objective:** Verify starter pack is issued after first listing approval

**Steps:**
1. Login as User A (Kids Club+ subscriber)
2. Navigate to Profile screen
3. Tap "Create New Listing"
4. Fill in listing details:
   - Title: "Test Item for Starter Pack"
   - Category: Toys
   - Price: $10
   - Upload photo
5. Submit listing
6. **Admin action:** Approve listing in admin panel
7. Navigate to Profile > SP Wallet

**Expected Results:**
- ✅ Wallet shows +10 SP (or configured amount)
- ✅ Transaction history shows "Starter Pack: First listing approved"
- ✅ Balance Before: 0 SP
- ✅ Balance After: 10 SP
- ✅ Ledger entry created with `transaction_type = 'earn_starter_pack'`
- ✅ SP batch created with `source_type = 'starter_pack'`
- ✅ Expiration date = 365 days from now (or configured)

**SQL Verification:**
```sql
-- Replace USER_A_ID with actual user ID
SELECT * FROM sp_wallets WHERE user_id = 'USER_A_ID';
-- Expected: starter_pack_issued = true, available_balance = 10

SELECT * FROM sp_ledger 
WHERE user_id = 'USER_A_ID' AND transaction_type = 'earn_starter_pack';
-- Expected: 1 row with amount = 10

SELECT * FROM sp_batches 
WHERE user_id = 'USER_A_ID' AND source_type = 'starter_pack';
-- Expected: 1 batch with initial_sp = 10, remaining_sp = 10
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-002: Prevent Duplicate Starter Pack

**Objective:** Verify starter pack cannot be claimed twice

**Steps:**
1. Login as User A (who already received starter pack)
2. Create another listing
3. **Admin action:** Approve second listing
4. Check SP wallet

**Expected Results:**
- ✅ NO additional SP awarded
- ✅ Balance remains at 10 SP (from first starter pack)
- ✅ No new ledger entry for starter pack
- ✅ No error shown to user (silent rejection)

**SQL Verification:**
```sql
SELECT COUNT(*) FROM sp_ledger 
WHERE user_id = 'USER_A_ID' AND transaction_type = 'earn_starter_pack';
-- Expected: 1 (not 2)
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-003: Reject Starter Pack for Non-Subscriber

**Objective:** Verify free users cannot earn starter pack

**Steps:**
1. Create a new user (do NOT subscribe to Kids Club+)
2. Create and get first listing approved
3. Check SP wallet (should not exist or show 0 balance)

**Expected Results:**
- ✅ No SP awarded
- ✅ Wallet shows "Upgrade to Kids Club+ to earn Swap Points" banner
- ✅ No ledger entry created
- ✅ `starter_pack_issued` remains false

**SQL Verification:**
```sql
SELECT * FROM sp_wallets WHERE user_id = 'FREE_USER_ID';
-- Expected: starter_pack_issued = false, available_balance = 0
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Test Suite 2: Referral Rewards

### TC-SP-002-004: Award Referral Rewards (Happy Path)

**Objective:** Verify both referrer and referee receive SP rewards

**Prerequisites:**
- User B (referrer) has active subscription and referral code
- User C (referee) will sign up with User B's code

**Steps:**
1. Login as User B
2. Navigate to Profile > Referrals
3. Copy referral code
4. Logout
5. Sign up new user (User C) with referral code
6. Purchase Kids Club+ subscription for User C
7. Login as User B, check SP wallet
8. Login as User C, check SP wallet

**Expected Results:**
- ✅ User B (referrer) receives +50 SP (or configured amount)
- ✅ User C (referee) receives +25 SP (or configured amount)
- ✅ Both have ledger entries with `transaction_type = 'earn_referral'`
- ✅ Referral record updated to `status = 'claimed'`
- ✅ SP batches created for both users with `source_type = 'referral'`

**SQL Verification:**
```sql
-- Check referrer balance
SELECT available_balance FROM sp_wallets WHERE user_id = 'USER_B_ID';
-- Expected: 50 (if no other earnings)

-- Check referee balance
SELECT available_balance FROM sp_wallets WHERE user_id = 'USER_C_ID';
-- Expected: 25

-- Check referral record
SELECT * FROM referrals WHERE referrer_user_id = 'USER_B_ID' AND referred_user_id = 'USER_C_ID';
-- Expected: status = 'claimed', bonus_points = 50, bonus_points_referrer = 25

-- Check ledger entries
SELECT * FROM sp_ledger WHERE transaction_type = 'earn_referral' 
  AND user_id IN ('USER_B_ID', 'USER_C_ID');
-- Expected: 2 rows
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-005: Prevent Duplicate Referral Reward

**Objective:** Verify referral reward cannot be claimed twice

**Steps:**
1. Using same User B and User C from TC-SP-002-004
2. Attempt to trigger referral reward again (e.g., re-subscribe)
3. Check wallets

**Expected Results:**
- ✅ No additional SP awarded
- ✅ Balances remain unchanged
- ✅ No new ledger entries for referral
- ✅ Idempotency key prevents duplicate

**SQL Verification:**
```sql
SELECT COUNT(*) FROM sp_ledger 
WHERE transaction_type = 'earn_referral' AND user_id = 'USER_B_ID';
-- Expected: 1 (not 2)
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Test Suite 3: Challenge Rewards

### TC-SP-002-006: Award Challenge Completion Reward

**Objective:** Verify SP awarded when challenge is completed

**Prerequisites:**
- Create a test challenge in admin panel:
  - Title: "List 5 Items"
  - Reward: 100 SP
  - Target: 5 listings

**Steps:**
1. Login as User A
2. Navigate to Challenges screen
3. View "List 5 Items" challenge (shows 0/5)
4. Create 5 listings
5. Return to Challenges screen
6. Tap "Claim Reward" button
7. Navigate to SP Wallet

**Expected Results:**
- ✅ Challenge marked as completed
- ✅ +100 SP awarded
- ✅ Ledger entry shows "Challenge Reward: Completed challenge"
- ✅ "Claim Reward" button becomes "Claimed"
- ✅ Challenge moves to "Completed" tab

**SQL Verification:**
```sql
SELECT * FROM sp_ledger 
WHERE user_id = 'USER_A_ID' AND transaction_type = 'earn_challenge';
-- Expected: 1 row with amount = 100

SELECT * FROM sp_batches 
WHERE user_id = 'USER_A_ID' AND source_type = 'challenge';
-- Expected: 1 batch with initial_sp = 100
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-007: Prevent Duplicate Challenge Reward Claim

**Objective:** Verify challenge reward cannot be claimed twice

**Steps:**
1. Using same User A who already claimed challenge
2. Tap "Claim Reward" button again
3. Check wallet

**Expected Results:**
- ✅ Error toast: "Challenge reward already claimed"
- ✅ No additional SP awarded
- ✅ Balance remains unchanged

**SQL Verification:**
```sql
SELECT COUNT(*) FROM sp_ledger 
WHERE user_id = 'USER_A_ID' AND transaction_type = 'earn_challenge';
-- Expected: 1 (not 2)
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Test Suite 4: SP Refunds

### TC-SP-002-008: Refund SP for Cancelled Trade

**Objective:** Verify SP is refunded when trade is cancelled

**Prerequisites:**
- User A has 100 SP balance
- User A initiates a trade using 50 SP

**Steps:**
1. Login as User A
2. Browse items and find item priced at $10
3. At checkout, use SP slider to spend 50 SP
4. Complete purchase (trade status = 'pending')
5. **Seller action:** Seller cancels trade
6. Navigate to SP Wallet
7. Check transaction history

**Expected Results:**
- ✅ +50 SP refunded
- ✅ Ledger entry shows "Refund: Trade cancelled"
- ✅ Balance updated correctly (150 total: 100 original + 50 refund)
- ✅ New SP batch created with `source_type = 'refund'`
- ✅ Expiration date = 365 days from refund date

**SQL Verification:**
```sql
SELECT * FROM sp_ledger 
WHERE user_id = 'USER_A_ID' AND transaction_type = 'earn_refund';
-- Expected: 1 row with amount = 50

SELECT * FROM sp_batches 
WHERE user_id = 'USER_A_ID' AND source_type = 'refund';
-- Expected: 1 batch with initial_sp = 50, remaining_sp = 50

SELECT available_balance FROM sp_wallets WHERE user_id = 'USER_A_ID';
-- Expected: 150 (100 + 50)
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-009: Prevent Duplicate Refund

**Objective:** Verify refund cannot be processed twice for same trade

**Steps:**
1. Using same cancelled trade from TC-SP-002-008
2. **Admin action:** Attempt to manually trigger refund via SQL:
   ```sql
   SELECT refund_sp_for_cancelled_trade('USER_A_ID', 'TRADE_ID', 50);
   ```
3. Check result

**Expected Results:**
- ✅ SQL returns: `{"success": false, "error": "Refund already processed for this trade"}`
- ✅ No additional SP awarded
- ✅ Balance remains at 150 SP

**SQL Verification:**
```sql
SELECT COUNT(*) FROM sp_ledger 
WHERE related_transaction_id = 'TRADE_ID' AND transaction_type = 'earn_refund';
-- Expected: 1 (not 2)
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Test Suite 5: Fraud Prevention

### TC-SP-002-010: Rate Limiting - Max Referrals Per Day

**Objective:** Verify max referral rewards per day limit

**Steps:**
1. Get current limit from config:
   ```sql
   SELECT config_value FROM sp_config WHERE config_key = 'max_referral_rewards_per_day';
   -- Expected: 10 (default)
   ```
2. Create 11 referral records and try to claim all in one day
3. Check results

**Expected Results:**
- ✅ First 10 referrals: SP awarded successfully
- ✅ 11th referral: Error or queued for next day
- ✅ Admin alert triggered for suspicious activity

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-011: Subscription Check Enforcement

**Objective:** Verify all earning operations check subscription status

**Steps:**
1. User A has active subscription
2. User A earns 100 SP from challenge
3. **Admin action:** Cancel User A's subscription
4. Attempt to award another challenge reward to User A

**Expected Results:**
- ✅ First challenge: SP awarded (subscriber active)
- ✅ Second challenge: Error "Kids Club+ subscription required"
- ✅ No SP awarded after subscription cancellation
- ✅ Wallet state changes to 'frozen' or 'grace_period'

**SQL Verification:**
```sql
SELECT state FROM sp_wallets WHERE user_id = 'USER_A_ID';
-- Expected: 'frozen' or 'grace_period'

-- Attempt to award SP (should fail)
SELECT issue_starter_pack('USER_A_ID', 'LISTING_ID');
-- Expected: {"success": false, "error": "Kids Club+ subscription required"}
```

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Test Suite 6: UI/UX Verification

### TC-SP-002-012: SP Wallet Screen Display

**Objective:** Verify wallet screen shows correct information

**Steps:**
1. Login as User A (with SP balance)
2. Navigate to Profile > SP Wallet

**Expected Results:**
- ✅ Available Balance displayed prominently
- ✅ Pending Balance shown (if any)
- ✅ Lifetime Earned stat visible
- ✅ Lifetime Spent stat visible
- ✅ Transaction history list populated
- ✅ Each transaction shows:
  - Icon (✅ for earn, 💸 for spend)
  - Description
  - Date
  - Amount (+/-)
  - Balance after transaction
- ✅ Pull-to-refresh works
- ✅ Smooth scrolling

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

### TC-SP-002-013: Expiring SP Banner

**Objective:** Verify warning banner appears when SP is expiring soon

**Prerequisites:**
- User A has SP batch expiring in < 30 days

**Steps:**
1. Login as User A
2. Navigate to SP Wallet

**Expected Results:**
- ✅ Yellow/orange banner visible
- ✅ Banner text: "⚠️ SP Expiring Soon"
- ✅ Shows amount expiring
- ✅ Shows expiration date
- ✅ "View Details" button functional

**Status:** ☐ Pass ☐ Fail  
**Notes:** _______________

---

## Final Checklist

### Database Integrity
- ☐ All SP batches have valid expiration dates
- ☐ All ledger entries have corresponding wallet updates
- ☐ No negative balances in sp_wallets
- ☐ All idempotency keys are unique
- ☐ Ledger balance_before + amount = balance_after

### Performance
- ☐ Wallet screen loads in < 2 seconds
- ☐ SP award operations complete in < 1 second
- ☐ No memory leaks after 10 earning events

### Error Handling
- ☐ Graceful error messages for failed SP awards
- ☐ Network errors handled with retry logic
- ☐ Database errors logged properly

---

## Sign-Off

**Tester Signature:** _______________  
**Date Completed:** _______________  
**Overall Status:** ☐ All Tests Pass ☐ Issues Found (see notes)  
**Ready for Production:** ☐ Yes ☐ No

---

## Common Issues & Troubleshooting

### Issue: Starter pack not awarded
**Solution:** Check if:
1. User has active subscription
2. Listing is approved (status = 'available')
3. Starter pack not already issued

### Issue: Referral reward not working
**Solution:** Verify:
1. Both users have active subscriptions
2. Referral record exists in database
3. Idempotency key not duplicated

### Issue: Wallet screen shows 0 balance but ledger has entries
**Solution:**
1. Check sp_wallets.available_balance column
2. Verify wallet state is 'active' (not 'frozen')
3. Run wallet sync RPC if needed

---

**End of Manual Test Guide**
