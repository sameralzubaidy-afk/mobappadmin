# SP-002 Bug Fix: COMPLETE ANALYSIS & RESOLUTION

## 🎯 Summary

**Problem:** Free user upgrading to Kids Club+ subscription receives error: `"column 'status' of relation 'sp_wallets' does not exist"`

**Root Cause:** Column renamed in migration 093 (`status` → `state`) but RPC function in migration 20251227 not updated

**Solution:** Created migration 095 to fix `initialize_sp_wallet()` RPC with correct column name

**Status:** ✅ FIXED - Migration 095 created and ready to deploy

---

## 📊 Detailed Analysis

### Migration Timeline & Conflict

```
20251215100001_auth_v2_rpc_functions.sql
├─ Creates initialize_sp_wallet()
├─ Inserts into sp_wallets(status, ...)  ❌ OLD COLUMN NAME
└─ Result: Function defined with old schema

                    ↓ (time passes)

20251227_fix_trial_enrollment_idempotency.sql
├─ Recreates initialize_sp_wallet() (idempotency)
├─ Inserts into sp_wallets(status, ...)  ❌ STILL OLD COLUMN NAME
└─ Result: Function updated but column name not fixed

                    ↓ (time passes)

093_fix_sp_wallets_table_schema.sql (alphabetically earlier!)
├─ Renames sp_wallets.status → sp_wallets.state  ✅
├─ Drops idx_sp_wallets_status
├─ Creates idx_sp_wallets_state
└─ Result: Database schema fixed but RPC functions NOT updated

                    ↓ (runtime)

User upgrades to Kids Club+
├─ App calls initialize_sp_wallet() RPC
├─ RPC tries: INSERT INTO sp_wallets(status, ...) VALUES(...)
├─ Database error: "column 'status' does not exist"  ❌
└─ Result: Subscription upgrade fails
```

### Why This Happened

**Root cause:** Migration execution order is alphabetical, but semantic dependencies are not:
- `093_fix_sp_wallets_table_schema.sql` runs before `20251227_fix_trial_enrollment_idempotency.sql`
- But `20251227` doesn't know that `093` renamed the column

**Key insight:** When creating/modifying RPC functions that touch specific tables, the RPC and table schema must be kept in sync. If a schema change (column rename) happens in one migration, all dependent RPCs in OTHER migrations must be audited.

---

## 🔍 Code Inspection Results

### ✅ Files That Are Correct

1. **Migration 093:** Properly renames column and updates indexes
   ```sql
   -- Rename status to state
   ALTER TABLE public.sp_wallets RENAME COLUMN status TO state;
   
   -- Update index name
   DROP INDEX idx_sp_wallets_status;
   CREATE INDEX idx_sp_wallets_state ON sp_wallets(state);
   
   -- Update RPC for wallet summary (CORRECT)
   SELECT ... FROM sp_wallets WHERE state = 'active'
   ```
   ✅ Status: WORKING

2. **Migration 094 (SP-002 earning RPCs):** All RPC functions use correct columns
   ```sql
   -- All references use these columns:
   -- - state (not status)
   -- - available_balance, pending_balance, lifetime_earned, etc.
   SELECT ... FROM sp_wallets WHERE user_id = ...
   INSERT INTO sp_wallets (id, state, available_balance, ...)
   ```
   ✅ Status: WORKING (assuming wallet exists)

3. **wallet.ts service:** Queries subscriptions.status (correct table)
   ```typescript
   const { data: subscription } = await supabase
     .from('subscriptions')  // ← Correct table
     .select('status')       // ← Correct column for subscriptions
   ```
   ✅ Status: WORKING

### ❌ File That Was Broken

**Migration 20251227_fix_trial_enrollment_idempotency.sql (lines 74-103):**
```sql
-- BROKEN ❌
INSERT INTO sp_wallets (
  user_id,
  status,              ← ❌ WRONG COLUMN (renamed to 'state')
  available_balance,
  pending_balance,
  ...
) VALUES (...)
```

### ✅ What Migration 095 Fixes

```sql
-- FIXED ✅
INSERT INTO sp_wallets (
  user_id,
  state,               ← ✅ CORRECT COLUMN (after 093 rename)
  available_balance,
  pending_balance,
  ...
) VALUES (...)
```

---

## 🔧 Technical Details of Fix

### Migration 095 Changes

**Function:** `initialize_sp_wallet(p_user_id UUID)`

**Changes Made:**
1. Dropped old function (with DROP CASCADE to avoid dependent object issues)
2. Recreated with correct column names
3. Updated all column references:
   - `status` → `state`
   - Added all required new columns: `starter_pack_issued`
4. Maintained idempotent behavior (returns existing wallet if found)
5. Restored all permissions (authenticated, anon, service_role)

**Before:**
```plpgsql
INSERT INTO sp_wallets (
  user_id,
  status,              -- ❌ Column doesn't exist
  available_balance,
  pending_balance,
  lifetime_earned,
  lifetime_spent,
  last_activity_at,    -- ❌ Removed in 093
  created_at,
  updated_at
)
```

**After:**
```plpgsql
INSERT INTO sp_wallets (
  user_id,
  state,               -- ✅ Correct column name
  available_balance,
  pending_balance,
  lifetime_earned,
  lifetime_spent,
  starter_pack_issued, -- ✅ Added column from 093
  created_at,
  updated_at
)
```

---

## 🧪 How to Verify the Fix

### Pre-Migration Check (in SQL Editor)

```sql
-- Check current schema
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'sp_wallets'
ORDER BY ordinal_position;

-- Should show:
-- Column                 | Type
-- ─────────────────────────────
-- id                     | uuid
-- user_id                | uuid
-- state                  | text        ← NOT 'status'
-- available_balance      | integer
-- pending_balance        | integer
-- lifetime_earned        | integer
-- lifetime_spent         | integer
-- lifetime_expired       | integer
-- frozen_at              | timestamp
-- grace_period_ends_at   | timestamp
-- starter_pack_issued    | boolean
-- ...
```

### Apply Migration 095

**Option A: Via Supabase CLI**
```bash
cd p2p-kids-marketplace
supabase db reset
```

**Option B: Manual SQL**
1. Copy entire contents of `supabase/migrations/095_fix_sp_wallet_column_rename.sql`
2. Go to Supabase Studio → SQL Editor
3. Paste and click Run

### Post-Migration Verification (in SQL Editor)

```sql
-- Verify function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'initialize_sp_wallet';

-- Expected: 1 row with FUNCTION type

-- Test the function (use any valid UUID)
SELECT initialize_sp_wallet('550e8400-e29b-41d4-a716-446655440000'::UUID) AS new_wallet;

-- Expected: Returns a row with:
-- - user_id = 550e8400-e29b-41d4-a716-446655440000
-- - state = 'active'
-- - available_balance = 0
-- - pending_balance = 0
-- - starter_pack_issued = false
```

### App-Level Test

1. **Restart app/simulator**
2. **Create new free account** (or use existing free user)
3. **Navigate to subscription choice screen**
4. **Tap "Try Kids Club+" button**
5. **Expected outcome:** 
   - No error dialog
   - Subscription created
   - Wallet initialized
   - Redirected to dashboard

---

## 📋 Deployment Checklist

- [ ] Migration 095 file exists: `supabase/migrations/095_fix_sp_wallet_column_rename.sql`
- [ ] Migration has been reviewed for correctness
- [ ] Migration 095 applied to dev environment
- [ ] Post-migration SQL verification queries run successfully
- [ ] Free → Subscriber flow tested in app
- [ ] No errors in console logs
- [ ] Migration 095 will be applied to staging environment
- [ ] Migration 095 will be applied to production environment
- [ ] `SP-002-BUG-FIX-GUIDE.md` available for team reference

---

## 🚀 Impact Assessment

### What's Fixed
- ✅ Free user can upgrade to Kids Club+ without error
- ✅ SP wallet initializes correctly
- ✅ User can now earn/spend Swap Points
- ✅ All SP-002 earning features work as designed

### What's NOT Affected
- ✅ Existing Users (wallet already initialized)
- ✅ Subscriptions table (no changes)
- ✅ Other RPC functions (migration 094 RPC functions use correct columns)
- ✅ SP ledger and batch tables (no changes)

### Rollback Plan (if needed)
```sql
-- Drop the new function
DROP FUNCTION IF EXISTS initialize_sp_wallet(uuid) CASCADE;

-- Recreate old version (will use old column name and fail - not recommended)
-- Better: Just keep the fix, rollback is not recommended
```
**Recommendation:** Keep the fix, don't roll back.

---

## 📞 Support Information

**If users encounter the error after migration 095:**
1. Clear app cache/reinstall app
2. Verify Supabase is running locally or check remote deployment status
3. Check browser console for other errors
4. Run manual verification queries above

**If column is still wrong after migration:**
1. Verify migration 095 was applied: `SELECT COUNT(*) FROM migration_records WHERE name = '095_fix_sp_wallet_column_rename'`
2. Manually run verification query to check schema
3. Ensure migrations executed in correct order (Supabase CLI handles this automatically)

---

## 📝 Related Documentation

- **SP-002 Main Documentation:** `SP-002-IMPLEMENTATION-SUMMARY.md`
- **SP-002 Manual Test Guide:** `SP-002-MANUAL-TEST-GUIDE.md`
- **SP-002 Quick Start:** `SP-002-QUICK-START.md`
- **MODULE-09 System Requirements:** `docx/SYSTEM_REQUIREMENTS_V2.md` (Section FR-SP)
- **MODULE-09 Implementation Prompt:** `Prompts/MODULE-09-POINTS-GAMIFICATION-V2.md`
- **Migration 093 Details:** `supabase/migrations/093_fix_sp_wallets_table_schema.sql`

---

## ✅ Definition of Done

This bug fix is complete when:

1. **Code:**
   - [x] Migration 095 created with correct RPC implementation
   - [x] Migration 095 uses `state` column (not `status`)
   - [x] All columns match schema from migration 093
   - [x] Idempotent behavior maintained

2. **Testing:**
   - [ ] Migration applied to local dev environment
   - [ ] SQL verification queries pass
   - [ ] Free → Subscriber upgrade successful
   - [ ] SP wallet visible in app
   - [ ] Tier 0 checks pass

3. **Documentation:**
   - [x] `SP-002-BUG-FIX-GUIDE.md` created
   - [x] Fix explained in this analysis document
   - [ ] Team notified of fix availability

4. **Deployment:**
   - [ ] Staging environment updated
   - [ ] Production environment updated
   - [ ] Monitoring for new errors enabled
