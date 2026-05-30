# 🔒 CRITICAL SECURITY FIX: Server-Side Minimum Withdrawal Enforcement

## 🚨 Issue Discovered

**What happened:**  
User configured minimum withdrawal to $2.00 (200 cents) in admin config, but the mobile app allowed a $1.50 withdrawal to complete successfully.

**Root Cause:**  
The minimum withdrawal validation was **ONLY** happening on the mobile app (client-side). The RPC function `request_seller_payout` in the database did NOT check the minimum. This is a **critical security vulnerability** - client-side validation can be bypassed.

**Evidence:**  
Screenshot shows: "Your withdrawal of $1.50 has been initiated" despite $2.00 minimum configured.

---

## ✅ Solution Applied

### Migration 076: Server-Side Enforcement
**File:** `supabase/migrations/076_enforce_minimum_withdrawal_in_rpc.sql`

**What it does:**
1. **Fetches minimum from admin_config** inside the RPC function
2. **Validates BEFORE processing** the payout request
3. **Returns structured error** if amount is below minimum
4. **Respects $0 = disabled** rule (if minimum is 0, validation is skipped)

**Key Code Addition:**
```sql
-- Fetch minimum withdrawal amount from admin_config
SELECT value INTO v_config_value 
FROM admin_config 
WHERE key = 'minimum_withdrawal_amount_cents' 
AND is_active = TRUE;

-- Default to 500 cents if not configured
IF v_config_value IS NULL OR v_config_value = '' THEN
  v_minimum_withdrawal_cents := 500;
ELSE
  v_minimum_withdrawal_cents := v_config_value::INTEGER;
END IF;

-- Validate minimum (if minimum > 0)
IF v_minimum_withdrawal_cents > 0 AND p_amount_cents < v_minimum_withdrawal_cents THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Minimum withdrawal amount is $' || (v_minimum_withdrawal_cents / 100.0)::TEXT,
    'minimum_required', v_minimum_withdrawal_cents,
    'requested', p_amount_cents
  );
END IF;
```

---

## 🧪 Testing Plan

### Before Migration (Current Broken Behavior)
```bash
# Set minimum to $2.00 via admin config
UPDATE admin_config SET value = '200' WHERE key = 'minimum_withdrawal_amount_cents';

# User with $1.50 balance can withdraw (WRONG! ❌)
# RPC allows it because no server-side check exists
```

### After Migration (Fixed Behavior)
```bash
# Apply migration
cd supabase
supabase db push

# Verify migration applied
SELECT value FROM admin_config WHERE key = 'minimum_withdrawal_amount_cents';
# Expected: 200 (or whatever admin configured)

# Test RPC directly (should fail)
SELECT request_seller_payout(auth.uid(), 150); -- $1.50 request
# Expected result: {"success": false, "error": "Minimum withdrawal amount is $2.00"}

# Test with valid amount (should succeed if balance exists)
SELECT request_seller_payout(auth.uid(), 200); -- $2.00 request
# Expected result: {"success": true, "payout_id": "...", ...}
```

### Mobile App Testing
1. **Set minimum to $5.00 via admin config:**
   ```sql
   UPDATE admin_config SET value = '500' WHERE key = 'minimum_withdrawal_amount_cents';
   ```

2. **Test Case A: Below Minimum**
   - User balance: $3.00
   - Tap "Withdraw Now"
   - **Expected:** Error alert "Minimum withdrawal amount is $5.00"
   - **Result:** Withdrawal blocked ✅

3. **Test Case B: At Minimum**
   - User balance: $5.00
   - Tap "Withdraw Now"
   - **Expected:** Withdrawal proceeds successfully
   - **Result:** Payout created ✅

4. **Test Case C: Minimum Disabled**
   - Set minimum to $0:
     ```sql
     UPDATE admin_config SET value = '0' WHERE key = 'minimum_withdrawal_amount_cents';
     ```
   - User balance: $0.50
   - Tap "Withdraw Now"
   - **Expected:** Withdrawal proceeds (no minimum check)
   - **Result:** Payout created ✅

5. **Test Case D: Admin Changes Minimum Mid-Session**
   - User opens app with $3.00 balance (minimum = $5)
   - Withdraw button disabled
   - Admin changes minimum to $2.00 via admin config
   - User pulls to refresh or reopens screen
   - **Expected:** Withdraw button now enabled
   - **Result:** Validation respects new minimum ✅

---

## 🔐 Security Improvements

### Before (Vulnerable)
```
┌──────────────┐
│  Mobile App  │  ← Client-side validation only
└──────┬───────┘
       │ request_seller_payout(150) -- $1.50
       ▼
┌──────────────┐
│  RPC Function│  ← NO minimum check ❌
└──────┬───────┘
       │ Creates payout (wrongly allowed)
       ▼
┌──────────────┐
│   Database   │  ← Payout created
└──────────────┘
```

### After (Secure)
```
┌──────────────┐
│  Mobile App  │  ← Client-side validation (UX feedback)
└──────┬───────┘
       │ request_seller_payout(150) -- $1.50
       ▼
┌──────────────┐
│  RPC Function│  ← ✅ Checks admin_config minimum
│              │  ← ✅ Rejects if below minimum
└──────┬───────┘
       │ Returns error: "Minimum is $2.00"
       ▼
┌──────────────┐
│  Mobile App  │  ← Shows error alert
└──────────────┘
```

---

## 📋 Verification Checklist

### ✅ Pre-Migration Verification
- [x] Confirmed vulnerability exists ($1.50 withdrawal succeeded with $2.00 minimum)
- [x] Identified root cause (no server-side validation)
- [x] Created migration 076 with fix

### ✅ Migration Application
- [ ] Run `supabase db push` to apply migration 076
- [ ] Verify function updated: `\df request_seller_payout` in SQL editor
- [ ] Check migration success in Supabase Dashboard → Database → Migrations

### ✅ SQL-Level Testing
- [ ] Test below minimum: `SELECT request_seller_payout(auth.uid(), 100);`
  - Expected: `{"success": false, "error": "Minimum withdrawal amount is $5.00"}`
- [ ] Test at minimum: `SELECT request_seller_payout(auth.uid(), 500);`
  - Expected: `{"success": true, ...}` (if balance exists)
- [ ] Test with $0 minimum: 
  - Set: `UPDATE admin_config SET value = '0' WHERE key = 'minimum_withdrawal_amount_cents';`
  - Test: `SELECT request_seller_payout(auth.uid(), 10);` ($0.10)
  - Expected: `{"success": true, ...}` (validation skipped)

### ✅ Mobile App E2E Testing
- [ ] Test Case A: Below minimum (should fail)
- [ ] Test Case B: At minimum (should succeed)
- [ ] Test Case C: Above minimum (should succeed)
- [ ] Test Case D: $0 minimum (any amount works)
- [ ] Test Case E: Admin changes minimum mid-session (dynamic update)

### ✅ Edge Cases
- [ ] Test with NULL config value (should default to 500)
- [ ] Test with invalid config value (should default to 500)
- [ ] Test with negative config value (treated as 0, validation disabled)
- [ ] Test with very large minimum (e.g., $1,000,000)

---

## 🚀 Deployment Steps

### 1. Apply Migration
```bash
cd supabase
supabase db push
```

**Expected Output:**
```
Applying migration 076_enforce_minimum_withdrawal_in_rpc.sql...
✓ Migration applied successfully
```

### 2. Verify Function Updated
```sql
-- Check function exists and has correct signature
SELECT 
  proname, 
  pg_get_function_result(oid) as returns,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'request_seller_payout';
```

**Expected:** Function exists with `(p_user_id uuid, p_amount_cents integer)` signature

### 3. Test with Admin Config Values
```sql
-- Set minimum to $2.00
UPDATE admin_config SET value = '200' WHERE key = 'minimum_withdrawal_amount_cents';

-- Attempt $1.50 withdrawal (should fail)
SELECT request_seller_payout(auth.uid(), 150);
-- Expected: {"success": false, "error": "Minimum withdrawal amount is $2.00"}

-- Attempt $2.00 withdrawal (should succeed if balance exists)
SELECT request_seller_payout(auth.uid(), 200);
-- Expected: {"success": true, "payout_id": "..."}
```

### 4. Mobile App Verification
- Open app
- Navigate to Payout Settings
- Verify withdraw button behavior matches configured minimum
- Test pull-to-refresh to see dynamic changes

---

## 📊 Impact Analysis

### Security Impact
- **HIGH** - Closes critical validation bypass vulnerability
- **BEFORE:** Anyone could bypass client-side validation via API manipulation
- **AFTER:** Server enforces minimum, cannot be bypassed

### User Experience Impact
- **MINIMAL** - Legitimate users see no change (validation was already in client)
- **POSITIVE** - Error messages are now consistent between client and server
- **POSITIVE** - Admin changes take effect immediately (no app rebuild needed)

### Performance Impact
- **NEGLIGIBLE** - One additional SELECT query per withdrawal request
- **CACHED** - Admin config is small and frequently accessed (likely cached by Postgres)

---

## 🔄 Rollback Plan

If issues arise, revert the RPC function:

### Option A: Revert to Original (No Minimum Check)
```sql
-- Restore original function without minimum validation
-- (Copy original implementation from migration 074)
```

### Option B: Disable Minimum Temporarily
```sql
-- Set minimum to 0 (disables validation)
UPDATE admin_config 
SET value = '0', updated_at = now()
WHERE key = 'minimum_withdrawal_amount_cents';
```

### Option C: Drop and Recreate Function
```sql
DROP FUNCTION IF EXISTS request_seller_payout(UUID, INTEGER);
-- Then re-apply migration 074 for original implementation
```

---

## 📝 Related Files

### Migrations
- `supabase/migrations/075_add_minimum_withdrawal_to_admin_config.sql` - Adds config field
- `supabase/migrations/076_enforce_minimum_withdrawal_in_rpc.sql` - **THIS FIX** (server-side validation)

### Mobile App
- `p2p-kids-marketplace/src/services/sellerBalance.ts` - Client-side validation (lines ~240-280)
  - Now matches server validation but cannot be trusted for security

### Admin Portal
- `p2p-kids-admin/src/app/config/page.tsx` - Admin UI for changing minimum

### Documentation
- `PAY-003-MANUAL-TEST-GUIDE.md` - TS-024 updated with dynamic minimum tests
- `DYNAMIC-MINIMUM-WITHDRAWAL-IMPLEMENTATION.md` - Full implementation guide

---

## ✅ Success Criteria

- [x] RPC function fetches minimum from `admin_config`
- [x] RPC function validates amount before processing
- [x] RPC function respects $0 = disabled rule
- [x] Error messages are clear and actionable
- [x] Migration is idempotent (safe to re-run)
- [x] Defaults to $5.00 if config missing
- [ ] Manual testing confirms fix works (pending deployment)
- [ ] No legitimate withdrawals are blocked (pending testing)
- [ ] Vulnerability is closed (pending testing)

---

## 🎯 Final Status

**Status:** ✅ **FIX IMPLEMENTED - READY FOR TESTING**

**What's Done:**
- ✅ Created migration 076 with server-side validation
- ✅ RPC function now enforces minimum withdrawal amount
- ✅ Respects admin config value (including $0 = disabled)
- ✅ Returns clear error messages
- ✅ Falls back to safe default if config missing

**What's Next:**
1. **Apply migration:** `supabase db push`
2. **Test SQL-level:** Verify RPC rejects below-minimum amounts
3. **Test mobile app:** Confirm error messages appear correctly
4. **Test admin control:** Verify changing minimum takes effect immediately
5. **Mark as complete:** Update TS-024 verification status

---

## 🔑 Key Takeaway

**Never rely on client-side validation for financial transactions.**  
All monetary validations MUST be enforced server-side. Client-side validation is only for UX feedback.

This fix ensures that even if:
- User manipulates the mobile app code
- User crafts direct API calls
- User bypasses UI validation

The server will ALWAYS enforce the configured minimum withdrawal amount. 🔒
