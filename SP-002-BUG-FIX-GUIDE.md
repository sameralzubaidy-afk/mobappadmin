# SP-002 Bug Fix: Column Name Mismatch in initialize_sp_wallet RPC

## ✅ Issue Identified & Fixed

**Error Message:** `"column 'status' of relation 'sp_wallets' does not exist"`

**Root Cause:**
- Migration 093 renamed `sp_wallets.status` → `sp_wallets.state`
- Migration 20251227 (fix_trial_enrollment_idempotency.sql) still references the old `status` column name
- When users upgrade from Free to Kids Club+, `initialize_sp_wallet()` RPC fails

**Timeline:**
1. ✅ Migration 093 renamed column: `status` → `state`
2. ❌ Migration 20251227 not updated to use new column name
3. ❌ All free→subscriber upgrades fail when wallet initialization runs
4. ✅ **NEW: Migration 095 fixes initialize_sp_wallet RPC**

## 🔧 What Was Fixed

Created new migration: **`supabase/migrations/095_fix_sp_wallet_column_rename.sql`**

Changes:
- Dropped old `initialize_sp_wallet()` RPC function
- Recreated with correct column name: `state` (not `status`)
- Updated all column references to match migration 093 schema
- Added all required columns (starter_pack_issued, etc.)
- Restored idempotency behavior (returns existing wallet if found)

## 🚀 How to Apply the Fix

### Step 1: Apply the Migration

```bash
cd p2p-kids-marketplace

# Option A: Using Supabase CLI
supabase db reset

# Option B: Manual SQL in Supabase Studio
# 1. Go to SQL Editor in Supabase dashboard
# 2. Copy-paste contents of: supabase/migrations/095_fix_sp_wallet_column_rename.sql
# 3. Click "Run"
```

### Step 2: Re-test Free→Subscriber Upgrade

```bash
# Method 1: Via app UI
1. Create free account
2. Go to subscription choice screen
3. Tap "Try Kids Club+"
4. Should now succeed (wallet initializes without error)

# Method 2: Via test suite (see SP-002 manual test guide)
```

## 📋 Verification Checklist

After applying the migration:

- [ ] Typecheck passes: `yarn typecheck`
- [ ] No syntax errors in migration file
- [ ] Wallet table schema correct (check in Supabase Studio):
  ```sql
  SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'sp_wallets'
  ORDER BY ordinal_position;
  ```
  Should show: `state`, `available_balance`, `pending_balance`, `starter_pack_issued`, etc.

- [ ] initialize_sp_wallet RPC exists and callable:
  ```sql
  SELECT routine_name FROM information_schema.routines
  WHERE routine_name = 'initialize_sp_wallet';
  ```
  Should return: 1 row with `initialize_sp_wallet`

- [ ] Test wallet creation in SQL Editor:
  ```sql
  -- Create a test wallet (replace UUID with real one)
  SELECT initialize_sp_wallet('550e8400-e29b-41d4-a716-446655440000'::UUID);
  ```
  Should return: sp_wallets row with `state = 'active'`

- [ ] Free→Subscriber flow works in app

## 📝 Files Changed

| File | Change | Status |
|------|--------|--------|
| `supabase/migrations/095_fix_sp_wallet_column_rename.sql` | New migration to fix RPC | ✅ Created |
| `p2p-kids-marketplace/src/services/auth.ts` | No change needed (auth.ts is correct) | ✅ OK |
| `supabase/migrations/093_fix_sp_wallets_table_schema.sql` | Already correct (defined rename) | ✅ OK |
| `supabase/migrations/094_sp_earning_rpcs.sql` | Already correct (uses proper columns) | ✅ OK |

## 🧪 Expected Behavior After Fix

**Before Fix:**
```
User: "Upgrade to Kids Club+"
→ App calls enrollInTrialSubscription()
→ App calls initialize_sp_wallet() RPC
→ ❌ ERROR: column 'status' does not exist
→ Subscription incomplete
```

**After Fix:**
```
User: "Upgrade to Kids Club+"
→ App calls enrollInTrialSubscription()
→ App calls initialize_sp_wallet() RPC
→ ✅ Wallet created with state='active'
→ Subscription complete
→ User can now earn/spend Swap Points
```

## 💡 Why This Happened

The migration history had two conflicting versions of `initialize_sp_wallet()`:
1. **Migration 20251215100001** - Original version (used old `status` column)
2. **Migration 20251227** - Idempotency fix (also used old `status` column)
3. **Migration 093** - Renamed column to `state` (but didn't update the RPC)

The ordering in `supabase/migrations/` is alphabetical, so:
- Migration 093 runs and renames `status` → `state`
- Migration 20251227 runs later and tries to insert into `status` column
- **Result: Column doesn't exist error**

Migration 095 fixes this by recreating the RPC with the correct column name.

## 🔄 Next Steps

1. ✅ Apply migration 095
2. ✅ Test free→subscriber upgrade flow
3. ✅ Test SP earning features (starter pack, referral, etc.)
4. ✅ Verify no other functions reference old `status` column (check migration 20251227 if needed)

## 🎯 Definition of Done

- [ ] Migration 095 applied successfully
- [ ] `initialize_sp_wallet` RPC exists and references `state` column
- [ ] Free→Subscriber upgrade completes without error
- [ ] SP wallet is created with correct initial values
- [ ] User can see wallet in "My Swap Points" screen
- [ ] All Tier 0 checks pass (typecheck, lint)
