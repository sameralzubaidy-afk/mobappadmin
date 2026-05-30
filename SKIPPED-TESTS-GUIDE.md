# Test Skipping Guide - Why & How to Enable

**Current Status:** counts vary by environment. In the latest run we saw **116 skipped tests** and **681 passing tests**.

## Summary of Skipped Tests

| Category | Count | Reason | Status |
|----------|-------|--------|--------|
| **RLS Policy Blocking** | 26 tests | Database policies blocking inserts | 🔴 Needs DB fix |
| **Auth Creation Issues** | ~8 tests | Tests relied on `auth.signUp()` returning a user | 🟢 Mostly resolved |
| **Retroactive Badges** | 9 tests | is_admin() function ambiguity | 🔴 Needs DB fix |
| **Dynamic User Creation** | ~7 tests | Fake UUID strings / missing seeded users | 🟡 Partially resolved |
| **Empty Test Data** | 7 tests | itemId/listingId not populated | 🟡 Needs seed data |
| **Other** | ~50 tests | Various known limitations | 🟡 By design |

---

## 1. RLS Policy Blocking Tests (26 tests) 🔴 CRITICAL

### Files Affected:
- `pay-001-schema.test.ts` (8 tests)
- `payout-router-integration.test.ts` (11 tests)
- Other payout-related tests (7 tests)

### Why Skipped:
```
Error: "new row violates row-level security policy for table 'seller_payouts'"
```

The database has RLS (Row Level Security) policies that block INSERT/UPDATE operations on payout tables even when using the service role key.

### How to Enable:

**Step 1: Connect to Supabase Database**
```bash
# Option A: Use Supabase Dashboard
# Go to: https://app.supabase.com → Project → SQL Editor

# Option B: Use psql CLI
psql "postgresql://postgres:PASSWORD@db.drntwgporzabmxdqykrp.supabase.co:5432/postgres"
```

**Step 2: Apply RLS Fix**
```sql
-- Create policies allowing service role to bypass RLS

CREATE POLICY "Service role bypass - seller_payout_methods"
  ON seller_payout_methods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - seller_payouts"
  ON seller_payouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('seller_payout_methods', 'seller_payouts');
```

**Step 3: Re-run Tests**
```bash
npm run test:all
# Should see 26 more tests passing
```

---

## 2. Auth Integration Tests (~8 tests) 🟢 MOSTLY RESOLVED

### Files Affected:
- `p2p-kids-marketplace/src/services/__tests__/auth.integration.test.ts` (6 tests)
- `p2p-kids-marketplace/src/services/__tests__/verify_user_phone.integration.test.ts` (2 tests)
- (Other suites that dynamically create users)

### Root Cause (What was happening)
Some Supabase configurations (notably when email confirmation is required) can return `user=null` from `auth.signUp()` even without a hard error. Tests that immediately read `data.user.id` crash or create invalid fake UUIDs.

### What we changed (Fix)
Tests that need a real user ID now create users via the service-role Admin API:
- Helper: `p2p-kids-marketplace/src/test-helpers/authTestUtils.ts`
- Uses `auth.admin.createUser({ email_confirm: true })` when `SUPABASE_SERVICE_ROLE_KEY` is present
- Falls back to `auth.signUp()` only when service role is unavailable

### How to Enable / Run
Prereqs:
- `RUN_SUPABASE_E2E=true`
- `SUPABASE_URL` (or `EXPO_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (required for the “confirmed user” creation path)

Run:
```bash
npm run test:all
```

Note:
- Some test suites are still skipped for unrelated reasons (seed data, DB functions missing, known TODOs). Those are tracked in other sections of this guide.

---

## 3. Retroactive Badges Tests (9 tests) 🔴 NEEDS DB FIX

### Files Affected:
- `badges-retroactive.e2e.ts` (5 tests)
- `badges-retroactive.test.ts` (4 tests)

### Why Skipped:
```
Error: "function is_admin() is not unique"
```

The database has multiple `is_admin()` functions with the same name, causing ambiguity.

### How to Enable:

**Step 1: Find Duplicate Functions**
```sql
SELECT 
  p.proname as function_name,
  p.pronargs as param_count,
  a.nspname as schema,
  p.prosrc as source
FROM pg_proc p
JOIN pg_namespace a ON p.pronamespace = a.oid
WHERE p.proname = 'is_admin'
ORDER BY p.oid;
```

**Step 2: Drop Duplicates (Keep Only One)**
```sql
-- Drop all is_admin functions
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Recreate the correct one
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 3: Verify**
```sql
-- Should only return 1 function
SELECT COUNT(*) FROM pg_proc 
WHERE proname = 'is_admin';
```

**Step 4: Re-run Tests**
```bash
npm run test:all
# Should see 9 more tests passing
```

---

## 4. Dynamic User Creation & Missing RPCs (~7-12 tests) 🟡 PARTIALLY RESOLVED

### Files Affected:
- `referrals-v2.e2e.ts` (4 core tests + performance/security suites)
- Other tests trying to create users on-the-fly (7 tests)

### Why Skipped / Failing:
1. Tests using fake UUID strings like `"perf-test-1769876048065"` which PostgreSQL rejects
2. **Referral RPC functions (`create_referral_code`, `apply_referral_code`) not deployed** — tests gracefully skip with a warning if these are missing

### How to Enable:

**Option A: Use Seeded Users (Recommended)**
```bash
# Step 1: Run seed script
npm run seed:staging

# Step 2: Deploy missing RPC functions to your Supabase database
# See "Deploying Referral RPCs" below

# Step 3: Set optional env overrides (if using non-default seeded IDs)
export E2E_TEST_BUYER_ID=<uuid>
export E2E_TEST_SELLER_ID=<uuid>

# Step 4: Run tests
RUN_SUPABASE_E2E=true npm run test:all
```

### Deploying Referral RPCs

If referral tests are skipping with "Referral RPCs not available", deploy these RPC functions to your Supabase database:

**Step 1: Open Supabase SQL Editor**
```bash
# Go to: https://app.supabase.com → Project → SQL Editor
```

**Step 2: Create the referral code RPC**
```sql
CREATE OR REPLACE FUNCTION create_referral_code(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_code text;
  v_result jsonb;
BEGIN
  -- Generate 8-character lowercase alphanumeric code
  v_code := substr(md5(random()::text || p_user_id::text), 1, 8);
  
  -- Insert into referral_codes table (or update if exists)
  INSERT INTO referral_codes (user_id, code, created_at)
  VALUES (p_user_id, v_code, NOW())
  ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code
  RETURNING json_build_object('code', code) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 3: Create the apply referral code RPC**
```sql
CREATE OR REPLACE FUNCTION apply_referral_code(p_referee_id uuid, p_referral_code text)
RETURNS jsonb AS $$
DECLARE
  v_referrer_id uuid;
  v_result jsonb;
BEGIN
  -- Find the referrer by code
  SELECT user_id INTO v_referrer_id 
  FROM referral_codes 
  WHERE code = lower(p_referral_code)
  LIMIT 1;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Insert referral record
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, created_at)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending', NOW())
  RETURNING jsonb_build_object('success', true) INTO v_result;
  
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Referral already applied');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 4: Verify RPCs are created**
```sql
-- Should show both functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE 'create_referral_%' OR routine_name LIKE 'apply_referral_%';
```

**Step 5: Re-run tests**
```bash
RUN_SUPABASE_E2E=true npm run test:all
# Referral tests should now run instead of skip
```

**Option B: Generate Valid UUIDs**
```typescript
// In tests, use valid UUID v4 format
import { v4 as uuidv4 } from 'uuid';

const testUserId = uuidv4(); // Generates valid UUID like: "550e8400-e29b-41d4-a716-446655440000"
```

---

## 5. Empty Test Data Tests (7 tests) 🟡 NEEDS SEED DATA

### Files Affected:
- `badges-v2-003.e2e.ts` (3 tests)
- `admin-force-cancel.integration.test.ts` (4 tests)
- Other tests (multiple)

### Why Skipped:
Tests can't find seeded listings/items in the database:
```
Error: "No listings found for test seller. Run `npm run seed:staging` first."
```

### How to Enable:

**Step 1: Clean Old Data**
```bash
npm run clean:staging
```

**Step 2: Seed Fresh Data**
```bash
npm run seed:staging
```

**Step 3: Verify Seeding Worked**
```bash
# Check if listings exist
curl -X GET \
  'https://drntwgporzabmxdqykrp.supabase.co/rest/v1/items?user_id=eq.14be337c-aad6-403f-bab2-ba1a7d80b666' \
  -H 'apikey: YOUR_ANON_KEY'
```

**Step 4: Re-run Tests**
```bash
npm run test:all
# Should see 7 more tests passing
```

---

## 6. Other Skipped Tests (~50 tests) 🟡 BY DESIGN

### Common Reasons:
- **Intentionally disabled** - Tests that require manual setup or external services
- **Test data unavailable** - SP-earning tests, discovery tests
- **Infrastructure not ready** - Payout tests, webhook tests
- **Schema incomplete** - Badge category column missing

### Examples:
- `sp-002-earning.e2e.ts` - Requires specific trade flow setup
- `discovery-v2-002` - Scoring algorithm needs tuning
- `trade-flow-v2` - SP usage validation tests
- `payout-webhooks.smoke.test.ts` - Requires webhook infrastructure

---

## Quick Start: Enable All Tests

Run this sequence to enable maximum test coverage:

```bash
# 1. Clean and seed fresh data
npm run reset:staging

# 2. Connect to Supabase and apply RLS fixes
# Manually run the SQL from Section 1 above

# 3. Clean up duplicate is_admin() functions
# Manually run the SQL from Section 3 above

# 4. Disable email confirmation (if needed)
# In Supabase Dashboard → Authentication → Settings

# 5. Run all tests
npm run test:all
```

**Expected Results After All Fixes:**
```
Before: 112 skipped, 657 passing, 28 failing
After:  ~50 skipped (unavoidable), 700+ passing, <5 failing
```

---

## Testing Commands Reference

```bash
# Run all tests with staging data
npm run test:all

# Run specific test suites
npm run test:auth          # Auth tests only
npm run test:trades        # Trade tests only
npm run test:e2e           # E2E tests only
npm run test:integration   # Integration tests only

# Run with verbose output
npm run test:all -- --verbose

# Run single test file
npm run test:all -- src/__tests__/e2e/pay-001-schema.test.ts

# Reset everything and start fresh
npm run clean:staging
npm run seed:staging
npm run test:all
```

---

## Status Tracker

Use this checklist to track your progress:

- [ ] RLS policies applied (26 tests)
- [ ] Auth issues resolved (8 tests)
- [ ] is_admin() function cleaned (9 tests)
- [ ] Test data seeded (7 tests)
- [ ] All tests run and passing

---

## Need Help?

Check [TODO-DATABASE-ADMIN-FIXES.md](TODO-DATABASE-ADMIN-FIXES.md) for detailed technical documentation.
