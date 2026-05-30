# SP-003 & SP-004 Manual Test Cases

**Module:** MODULE-09-POINTS-GAMIFICATION-V2  
**Components:** SP-003 (SP Spending Logic) & SP-004 (SP Expiration System)  
**Last Updated:** 2025-01-05  
**Testing Environment:** Supabase Production

---

## Prerequisites

### Test User Accounts Required

1. **Free Tier User**
   - Email: `free-user-sp-test@example.com`
   - Status: No active subscription
   - Purpose: Verify SP features are gated for non-subscribers

2. **Active Subscriber (Kids Club+)**
   - Email: `subscriber-sp-test@example.com`
   - Status: Active subscription with valid `current_period_end`
   - SP Balance: 200 SP (100 available, 100 pending)
   - Purpose: Test full SP functionality

3. **Cancelled Subscriber (Grace Period)**
   - Email: `grace-user-sp-test@example.com`
   - Status: Subscription cancelled, within 90-day grace period
   - SP Balance: 150 SP (frozen)
   - Purpose: Test grace period and SP freeze behavior

### Required Database Setup

```sql
-- Verify SP config exists
SELECT * FROM sp_config WHERE config_key IN (
  'expiration_period_days',
  'grace_period_days',
  'expiration_warning_days'
);

-- Create test listings for purchase testing
INSERT INTO listings (seller_id, title, price_cents, payment_preference, status, node_id)
VALUES
  ('[SUBSCRIBER_USER_ID]', 'Test Item $5 - Cash Only', 500, 'cash_only', 'active', '[NODE_ID]'),
  ('[SUBSCRIBER_USER_ID]', 'Test Item $10 - Accept SP', 1000, 'accept_sp', 'active', '[NODE_ID]'),
  ('[SUBSCRIBER_USER_ID]', 'Test Item $20 - Donate', 2000, 'donate', 'active', '[NODE_ID]');

-- Create test SP batches with different expiration dates
INSERT INTO sp_batches (wallet_id, user_id, initial_sp, remaining_sp, source_type, expires_at, is_expired)
VALUES
  ('[WALLET_ID]', '[USER_ID]', 50, 50, 'reward', NOW() + INTERVAL '7 days', false),
  ('[WALLET_ID]', '[USER_ID]', 100, 100, 'challenge', NOW() + INTERVAL '30 days', false),
  ('[WALLET_ID]', '[USER_ID]', 50, 50, 'starter_pack', NOW() + INTERVAL '60 days', false);
```

---

## Test Suite 1: SP-003 Spending Logic

### TC-003-01: Free User Cannot Spend SP

**Objective:** Verify non-subscribers cannot use SP payment features

**Preconditions:**
- User is logged in as free tier user
- User has NO active subscription
- Test listing exists with `payment_preference = 'accept_sp'`

**Steps:**
1. Navigate to Discover tab
2. View a listing that accepts SP
3. Tap "Buy Now" button
4. Observe checkout screen

**Expected Results:**
- ✅ SP slider should NOT be visible
- ✅ Payment shows cash-only option
- ✅ No SP balance display shown
- ✅ Checkout proceeds with 100% cash payment

**Pass Criteria:** Free users cannot access SP payment features

---

### TC-003-02: Subscriber Can View SP Balance

**Objective:** Verify subscribers can see their SP wallet information

**Preconditions:**
- User is logged in as active subscriber
- User has SP balance (available + pending)

**Steps:**
1. Navigate to Home/Dashboard tab (you should see a "Swap Points Wallet" card)
2. **Tap on the "Swap Points Wallet" card** or "View Details →" link
3. Observe the dedicated SP Wallet screen

**Expected Results:**
- ✅ Available SP displayed correctly
- ✅ Pending SP displayed separately
- ✅ Lifetime stats visible (earned, spent, expired)
- ✅ Recent transactions list shown
- ✅ **Expiring batches section visible** (if any batches expiring in next 30 days)

**Pass Criteria:** SP wallet displays all required information accurately

**Note:** The Dashboard shows a summary card. You must tap it to see the full wallet screen with expiring batches.

---

### TC-003-03: SP Spending Capped at 50% of Item Price

**Objective:** Verify 50% SP cap enforcement in checkout

**Preconditions:**
- User is active subscriber
- User has 500+ SP available
- Test listing: $10 item, accepts SP

**Steps:**
1. Navigate to checkout for $10 item
2. Move SP slider to maximum
3. Observe SP amount and cash amount
4. Note platform fee calculation

**Expected Results:**
- ✅ Max SP usable: 500 SP ($5 equivalent)
- ✅ Remaining cash required: $5.00
- ✅ Platform fee charged on FULL $10 (e.g., $1.00 if 10% fee)
- ✅ Total cash payment: $6.00 ($5 item + $1 fee)
- ✅ Slider cannot exceed 500 SP

**Pass Criteria:** SP spending never exceeds 50% of item price

---

### TC-003-04: Seller Payment Preference "Cash Only" Blocks SP

**Objective:** Verify sellers can opt out of SP payments

**Preconditions:**
- User is active subscriber with 200+ SP
- Test listing: payment_preference = 'cash_only'

**Steps:**
1. View listing with "Cash Only" preference
2. Tap "Buy Now"
3. Observe checkout screen

**Expected Results:**
- ✅ SP slider NOT visible
- ✅ Message displayed: "Seller accepts cash only"
- ✅ Checkout requires 100% cash payment
- ✅ SP balance NOT deducted after purchase

**Pass Criteria:** Cash-only preference is enforced server-side

---

### TC-003-05: SP Deduction Creates Ledger Entry

**Objective:** Verify SP spending creates proper ledger records

**Preconditions:**
- User has 200 SP available
- Complete purchase using 100 SP

**Steps:**
1. Complete checkout using 100 SP + $5 cash
2. Navigate to SP Wallet
3. View transaction history
4. Check database ledger table

**Expected Results:**
- ✅ Wallet balance reduced by 100 SP (200 → 100)
- ✅ Ledger entry shows:
  - `transaction_type = 'spend'`
  - `amount = -100`
  - `related_trade_id = [TRADE_ID]`
  - `description` includes item title
- ✅ UI shows "Spent on [Item Title]" in history

**Database Verification:**
```sql
SELECT * FROM sp_ledger 
WHERE user_id = '[USER_ID]' 
AND transaction_type = 'spend'
ORDER BY created_at DESC LIMIT 1;
```

**Pass Criteria:** Every SP spend creates accurate ledger entry

---

### TC-003-06: Cancelled Trade Refunds SP

**Objective:** Verify SP refund logic when buyer cancels trade

**Preconditions:**
- User completed purchase using 100 SP
- Trade status = 'pending_pickup' or 'in_progress'

**Steps:**
1. Navigate to active trade
2. Tap "Cancel Trade" button
3. Confirm cancellation
4. Check SP wallet balance
5. View ledger history

**Expected Results:**
- ✅ SP balance increases by 100 (refunded)
- ✅ Ledger shows new entry:
  - `transaction_type = 'refund'`
  - `amount = +100`
  - `related_trade_id = [TRADE_ID]`
- ✅ Original spend entry remains (audit trail)
- ✅ UI shows "Refunded from [Item Title]"

**Database Verification:**
```sql
SELECT * FROM sp_ledger 
WHERE related_trade_id = '[TRADE_ID]'
ORDER BY created_at;
-- Should show 2 entries: spend (-100) and refund (+100)
```

**Pass Criteria:** Cancelled trades refund SP correctly

---

### TC-003-07: Platform Fee Always Charged in Cash

**Objective:** Verify platform fee cannot be paid with SP

**Preconditions:**
- User is subscriber with 1000+ SP
- Test item: $20, accepts SP

**Steps:**
1. Proceed to checkout for $20 item
2. Use maximum SP (1000 SP = $10)
3. Review payment breakdown
4. Complete purchase

**Expected Results:**
- ✅ SP used: 1000 ($10 equivalent)
- ✅ Item cash remaining: $10
- ✅ Platform fee: $2.00 (10% of $20)
- ✅ Total cash payment: $12.00 ($10 + $2 fee)
- ✅ SP does NOT reduce platform fee

**Pass Criteria:** Platform fee is always 100% cash

---

### TC-003-08: Insufficient SP Prevents Overspending

**Objective:** Verify users cannot spend more SP than available

**Preconditions:**
- User has exactly 50 SP available
- Test item: $20, accepts SP

**Steps:**
1. Proceed to checkout for $20 item
2. Move SP slider to maximum
3. Observe SP amount capped

**Expected Results:**
- ✅ Max SP usable: 50 (user's available balance)
- ✅ Slider cannot exceed 50
- ✅ Remaining cash: $19.50 ($20 - $0.50 SP)
- ✅ Platform fee still calculated on full $20

**Pass Criteria:** Users cannot overspend available SP

---

## Test Suite 2: SP-004 Expiration System

### TC-004-01: New SP Batch Has Expiration Date

**Objective:** Verify SP batches created with proper expiration

**Preconditions:**
- User is active subscriber
- SP config: `expiration_period_days = 90`

**Steps:**
1. Trigger SP earning event (e.g., complete starter pack onboarding)
2. Check database sp_batches table
3. Calculate expected expiration date

**Expected Results:**
- ✅ New batch has `expires_at = NOW() + 90 days`
- ✅ `is_expired = false`
- ✅ `remaining_sp = initial_sp`

**Database Verification:**
```sql
SELECT id, initial_sp, remaining_sp, expires_at, is_expired, created_at
FROM sp_batches
WHERE user_id = '[USER_ID]'
ORDER BY created_at DESC LIMIT 1;
```

**Pass Criteria:** All new SP batches have expiration date set

---

### TC-004-02: Expiration Warnings Display in Wallet

**Objective:** Verify users see warnings for expiring SP

**Preconditions:**
- User has SP batches expiring in: 7 days, 30 days, 60 days

**Steps:**
1. Navigate to SP Wallet screen
2. View "Expiring Soon" section
3. Observe warning colors and messages

**Expected Results:**
- ✅ Banner shows total SP expiring in next 30 days
- ✅ Color-coded batches:
  - 7 days → Red badge
  - 30 days → Orange badge
  - 60 days → Green badge
- ✅ Each batch shows: amount + countdown
- ✅ Pull-to-refresh updates data

**Pass Criteria:** Expiration warnings are visible and color-coded

---

### TC-004-03: Expiration Processing Marks Batches Expired

**Objective:** Verify automated expiration job works correctly

**Preconditions:**
- Create test batch with `expires_at = NOW() - 1 day`

**Steps:**
1. Run expiration processing RPC:
   ```sql
   SELECT * FROM process_sp_expiration();
   ```
2. Check batch status
3. Check wallet balance
4. Check ledger entry

**Expected Results:**
- ✅ Batch marked: `is_expired = true`
- ✅ Wallet balance reduced by batch amount
- ✅ Wallet `lifetime_expired` increased
- ✅ Ledger entry created:
  - `transaction_type = 'expire'`
  - `amount = -[BATCH_AMOUNT]`
  - `related_batch_id = [BATCH_ID]`

**Database Verification:**
```sql
-- Check batch
SELECT is_expired FROM sp_batches WHERE id = '[BATCH_ID]';

-- Check ledger
SELECT * FROM sp_ledger WHERE related_batch_id = '[BATCH_ID]' AND transaction_type = 'expire';
```

**Pass Criteria:** Expired batches are processed correctly

---

### TC-004-04: Warning Notifications Created at Intervals

**Objective:** Verify warning records created at configured days

**Preconditions:**
- SP config: `expiration_warning_days = [30, 14, 7, 1]`
- User has batch expiring in 30 days

**Steps:**
1. Run warning creation RPC:
   ```sql
   SELECT * FROM send_sp_expiration_warnings();
   ```
2. Check sp_expiration_warnings table

**Expected Results:**
- ✅ Warning record created:
  - `warning_type = '30_day'`
  - `sp_amount = [BATCH_AMOUNT]`
  - `expires_at = [BATCH_EXPIRY]`
  - `notification_sent = false`

**Database Verification:**
```sql
SELECT * FROM sp_expiration_warnings
WHERE user_id = '[USER_ID]' AND warning_type = '30_day';
```

**Pass Criteria:** Warning records created at correct intervals

---

### TC-004-05: Duplicate Warnings Not Created

**Objective:** Verify warning system doesn't create duplicates

**Preconditions:**
- Warning already exists for batch expiring in 7 days

**Steps:**
1. Run warning creation RPC twice:
   ```sql
   SELECT * FROM send_sp_expiration_warnings();
   SELECT * FROM send_sp_expiration_warnings();
   ```
2. Check sp_expiration_warnings table

**Expected Results:**
- ✅ First run: `warnings_created = 1`
- ✅ Second run: `warnings_created = 0`
- ✅ Only ONE warning record exists per batch per type

**Pass Criteria:** No duplicate warnings created

---

### TC-004-06: Grace Period Freezes SP

**Objective:** Verify cancelled subscriptions freeze SP

**Preconditions:**
- User has active subscription
- User has 150 SP available
- User cancels subscription (enters grace period)

**Steps:**
1. Cancel subscription via Stripe
2. Wait for webhook to process
3. Check SP wallet in app
4. Attempt to use SP in checkout

**Expected Results:**
- ✅ Wallet shows SP as "frozen"
- ✅ SP slider disabled in checkout
- ✅ Message: "SP frozen during grace period"
- ✅ Database: `sp_wallets.grace_period_ends_at` set
- ✅ User can still view wallet and history

**Database Verification:**
```sql
SELECT available_balance, grace_period_ends_at, frozen_at
FROM sp_wallets WHERE user_id = '[USER_ID]';
```

**Pass Criteria:** SP is frozen but not deleted during grace period

---

### TC-004-07: Reactivation Unfreezes SP

**Objective:** Verify resubscription unfreezes SP

**Preconditions:**
- User in grace period with frozen SP
- User resubscribes within 90 days

**Steps:**
1. Complete subscription renewal
2. Wait for webhook to process
3. Check SP wallet
4. Attempt to use SP in checkout

**Expected Results:**
- ✅ SP unfrozen and available
- ✅ SP slider enabled in checkout
- ✅ Database: `grace_period_ends_at = NULL`, `frozen_at = NULL`
- ✅ No SP lost during grace period

**Pass Criteria:** Resubscription restores full SP access

---

### TC-004-08: Grace Period Expiry Expires SP

**Objective:** Verify SP expires after 90-day grace period

**Preconditions:**
- User in grace period with frozen SP
- Grace period end date passed

**Steps:**
1. Simulate grace period end (manual date update or wait)
2. Run expiration processing
3. Check SP wallet

**Expected Results:**
- ✅ All frozen SP marked as expired
- ✅ Wallet balance = 0
- ✅ Ledger entries created for each batch expiration
- ✅ `lifetime_expired` updated

**Database Verification:**
```sql
-- Check all batches expired
SELECT COUNT(*) FROM sp_batches 
WHERE user_id = '[USER_ID]' AND is_expired = true;

-- Check wallet zeroed
SELECT available_balance FROM sp_wallets WHERE user_id = '[USER_ID]';
```

**Pass Criteria:** SP expires completely after grace period

---

### TC-004-09: Admin Can Override Expiration Config

**Objective:** Verify admin can change expiration periods

**Preconditions:**
- Admin access to Supabase dashboard

**Steps:**
1. Update sp_config:
   ```sql
   UPDATE sp_config 
   SET config_value = '120' 
   WHERE config_key = 'expiration_period_days';
   ```
2. Trigger new SP earning event
3. Check new batch expiration date

**Expected Results:**
- ✅ New batches expire in 120 days (not 90)
- ✅ Existing batches unchanged
- ✅ Warning intervals still work with new period

**Pass Criteria:** Config changes apply to new SP only

---

### TC-004-10: FIFO SP Spending (Oldest First)

**Objective:** Verify SP spending uses oldest batches first

**Preconditions:**
- User has 3 batches:
  - Batch A: 50 SP, expires in 7 days
  - Batch B: 100 SP, expires in 30 days
  - Batch C: 50 SP, expires in 60 days

**Steps:**
1. Complete purchase using 75 SP
2. Check sp_batches table after purchase
3. Verify which batches were debited

**Expected Results:**
- ✅ Batch A: remaining_sp = 0 (fully used)
- ✅ Batch B: remaining_sp = 75 (25 used)
- ✅ Batch C: remaining_sp = 50 (untouched)

**Database Verification:**
```sql
SELECT id, remaining_sp, expires_at 
FROM sp_batches 
WHERE user_id = '[USER_ID]'
ORDER BY expires_at ASC;
```

**Pass Criteria:** Oldest expiring batches consumed first

---

## Test Execution Checklist

### Before Testing
- [ ] Supabase production environment accessible
- [ ] Test users created with correct subscription states
- [ ] Test listings created with various payment preferences
- [ ] SP batches seeded with different expiration dates
- [ ] Database backup created (in case rollback needed)

### During Testing
- [ ] Record all failures with screenshots
- [ ] Note any error messages or unexpected behavior
- [ ] Check database state after each test
- [ ] Document any config assumptions

### After Testing
- [ ] All tests passed or failures documented
- [ ] Database cleaned of test data
- [ ] Verification items updated in MODULE-09-VERIFICATION-V2.md
- [ ] Any bugs filed with reproduction steps

---

## Expected Test Results Summary

**SP-003 (Spending Logic):**
- ✅ 8 test cases covering payment flow, refunds, fee calculation
- ✅ All edge cases (insufficient SP, cash-only, 50% cap) validated
- ✅ Ledger integrity confirmed

**SP-004 (Expiration System):**
- ✅ 10 test cases covering expiration lifecycle
- ✅ Warning system validated at all intervals
- ✅ Grace period freeze/unfreeze/expiry confirmed
- ✅ FIFO consumption order verified

---

## Troubleshooting Common Issues

### Issue: SP slider not visible for subscriber
**Cause:** User subscription status not synced  
**Fix:** Check subscriptions table, run webhook manually if needed

### Issue: Expiration warnings not showing
**Cause:** `send_sp_expiration_warnings()` not run recently  
**Fix:** Manually trigger RPC or check cron job configuration

### Issue: SP balance incorrect after purchase
**Cause:** Ledger entry failed or RPC error  
**Fix:** Check Supabase logs, verify `debit_sp_for_trade()` executed

### Issue: Grace period SP not frozen
**Cause:** Webhook didn't update wallet  
**Fix:** Check webhook logs, manually set `grace_period_ends_at`

---

## Sign-Off

**Tester Name:** _________________  
**Test Date:** _________________  
**Environment:** Supabase Production  
**Result:** ☐ All Pass  ☐ Failures Documented  
**Notes:** _________________
