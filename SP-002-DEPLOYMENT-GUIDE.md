# 🚀 DEPLOYMENT GUIDE: SP-002 Bug Fix + Listing Approval Feature

## 📋 Overview

Two migrations are ready to deploy:
1. **Migration 095** – Fixes SP wallet bug (critical, blocking issue)
2. **Migration 096** – Adds listing approval workflow (new feature)

**Total Changes:** ~600 lines of SQL + UI updates  
**Risk Level:** LOW  
**Deployment Time:** ~5 minutes  

---

## ✅ Pre-Deployment Checklist

- [x] Migration 095 created and tested locally
- [x] Migration 096 created with 5 RPC functions
- [x] Admin UI component syntax verified (TypeScript compiles)
- [x] All RPC functions are idempotent
- [x] RLS policies configured
- [x] Indexes created for performance
- [x] Verification queries provided

---

## 🎯 Deployment Steps

### Step 1: Backup Staging Database (Optional but Recommended)

In Supabase dashboard → Project settings → Database, click "Backup" or use:

```bash
# Via Supabase CLI (if configured)
supabase db backup create --project-ref <project-id>
```

**Note:** Staging database auto-backups daily. No action required if confident.

---

### Step 2: Deploy Migration 095 (SP Wallet Bug Fix)

**Option A: Via Supabase CLI (Recommended)**

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Push all pending migrations to staging
supabase db push

# Output should show:
# ✓ Uploaded new migration 095_fix_sp_wallet_column_rename.sql
# ✓ Uploaded new migration 096_listing_approval_and_starter_pack_eligibility.sql
```

**Option B: Manual Deployment (SQL Editor)**

1. Open Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/095_fix_sp_wallet_column_rename.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Expected result: ✅ Success (no errors)

---

### Step 3: Deploy Migration 096 (Listing Approval Feature)

**Same as above** – if you used `supabase db push`, this is already deployed!

If deploying manually:

1. Open file: `supabase/migrations/096_listing_approval_and_starter_pack_eligibility.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"
5. Expected result: ✅ Success (all RPC functions created)

---

### Step 4: Verify Migrations Applied Successfully

Run these queries in Supabase SQL Editor to confirm:

```sql
-- 1. Verify Migration 095: initialize_sp_wallet function uses 'state' column
SELECT pg_get_functiondef(
  (SELECT oid FROM pg_proc WHERE proname = 'initialize_sp_wallet')
) AS function_definition;
-- Should contain: 'state' not 'status'

-- 2. Verify Migration 096: New columns on items table
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'items' 
  AND column_name IN ('status', 'approved_at', 'approved_by', 'eligible_for_starter_pack', 'starter_pack_claimed', 'starter_pack_claimed_at')
ORDER BY ordinal_position DESC;

-- Expected columns:
-- status | text | NO
-- approved_at | timestamp with time zone | YES
-- approved_by | uuid | YES
-- eligible_for_starter_pack | boolean | NO
-- starter_pack_claimed | boolean | NO
-- starter_pack_claimed_at | timestamp with time zone | YES

-- 3. Verify admin_notifications table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'admin_notifications'
) AS table_exists;
-- Should return: true

-- 4. Verify all 5 RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN (
  'is_eligible_for_starter_pack',
  'admin_approve_listing',
  'mark_starter_pack_claimed',
  'get_admin_notifications',
  'mark_notification_as_read'
)
ORDER BY routine_name;
-- Should return 5 rows

-- 5. Test initialize_sp_wallet function with a test UUID
-- DO NOT run in production unless you want to create a real wallet
-- SELECT initialize_sp_wallet('550e8400-e29b-41d4-a716-446655440000'::UUID);
```

---

## 🧪 Post-Deployment Testing

### Test 1: Verify SP Wallet Bug is Fixed

**Scenario:** User is in free tier, upgrades to Kids Club+

```bash
# In mobile app or via Edge Function:
# Call: supabase.rpc('initialize_sp_wallet', { p_user_id: user_id })

# Expected: ✅ Success - wallet created with state='active'
# Old error: ✗ "column 'status' does not exist"
```

### Test 2: Verify Listing Approval Feature Works

**Scenario:** Admin approves a pending listing

```bash
# In Supabase SQL Editor:
-- 1. Create a test listing (as subscriber seller)
INSERT INTO items (id, seller_id, title, price, status, eligible_for_starter_pack)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'seller-uuid-here'::UUID,
  'Test Item',
  19.99,
  'pending',
  TRUE
);

-- 2. Admin approves it
SELECT admin_approve_listing(
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'admin-uuid-here'::UUID,
  'Test approval'
);

-- Expected: { "success": true, "message": "Listing approved successfully" }

-- 3. Verify status changed
SELECT status, approved_at, approved_by 
FROM items 
WHERE id = '550e8400-e29b-41d4-a716-446655440000'::UUID;

-- Expected: status = 'available', approved_at = now(), approved_by = admin-uuid
```

### Test 3: Admin UI Shows Starter Pack Badge

**Scenario:** Admin opens listing management, sees pending item with badge

```
Steps in admin dashboard:
1. Navigate to Listing Management
2. Search for the test item
3. Verify table shows "🎁 Eligible" or "🎁 Claimed" badge
4. Click item to open detail panel
5. Verify green box shows "🎁 Starter Pack Eligible"
6. Click "✅ Approve Listing" button
7. Verify status changes to "Available"
```

---

## 📱 Updated Manual Test Guide

See [SP-002-MANUAL-TEST-GUIDE.md](SP-002-MANUAL-TEST-GUIDE.md) for complete test procedures.

Key test case updated:
- **TC-SP-002-001 (Issue Starter Pack)**: Now uses admin approval button instead of manual SQL

---

## 🔄 Rollback Plan (If Needed)

**If something breaks after deployment:**

### Option 1: Drop Recent Functions (Quick Fix)
```sql
-- This removes the new functions but keeps the schema changes
DROP FUNCTION IF EXISTS admin_approve_listing(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_eligible_for_starter_pack(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_starter_pack_claimed(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_admin_notifications(UUID, INT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS mark_notification_as_read(UUID) CASCADE;
DROP TABLE IF EXISTS admin_notifications CASCADE;

-- initialize_sp_wallet is already fixed, no need to drop
-- Schema columns (status, eligible_for_starter_pack, etc.) can remain
```

### Option 2: Full Rollback (If Schema Changes Caused Issues)
```bash
# This reverts to the previous database state
supabase db reset

# Then manually run only Migration 095:
# (Skip migration 096)
```

**Recovery Steps:**
1. Contact Samer or check Supabase dashboard for automatic backups
2. Restore from backup point
3. Run only Migration 095 (SP wallet fix)
4. Skip Migration 096 for now
5. Investigate error and create patched version

---

## ⚠️ Important Notes

### About Migration 095 (SP Wallet Fix)
- **Critical Priority:** Blocks free → Kids Club+ upgrade flow
- **Risk:** Very LOW – only updates RPC function, no data loss
- **Rollback:** Can be safely removed without data loss

### About Migration 096 (Listing Approval)
- **Priority:** Medium – new feature, enables test cases
- **Risk:** LOW – additive changes, no breaking changes
- **Rollback:** Can be removed; keeps schema columns but no longer usable

### Schema Column Cleanup (Optional)
If Migration 096 is rolled back, the new columns on `items` table can optionally be removed:
```sql
ALTER TABLE items 
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS eligible_for_starter_pack,
  DROP COLUMN IF EXISTS starter_pack_claimed,
  DROP COLUMN IF EXISTS starter_pack_claimed_at;
```

---

## 📞 Support & Troubleshooting

### Issue: "Function already exists" Error
**Cause:** Migration 095 or 096 was already applied
**Fix:** This is harmless – migrations are idempotent. Running again is safe.

### Issue: "Column already exists" Error
**Cause:** Same as above
**Fix:** Idempotent – safe to rerun

### Issue: RPC Function Returns Error
**Cause:** RLS policy blocking the call, or invalid input
**Solution:** 
- Verify user is authenticated
- Check RLS policies with: `SELECT * FROM pg_policies WHERE tablename = 'admin_notifications';`
- Verify admin_id matches current user: `SELECT auth.uid();`

### Issue: Admin UI Shows Old Data
**Cause:** Browser cache or client not refetching
**Fix:** Hard refresh browser (Cmd+Shift+R on Mac) or clear cache

---

## ✅ Deployment Sign-Off Checklist

Before declaring deployment complete:

- [ ] Migration 095 deployed successfully (no errors)
- [ ] Migration 096 deployed successfully (no errors)
- [ ] Verification queries return expected results
- [ ] SP wallet bug fix verified (test upgrading free user to subscriber)
- [ ] Admin UI component deployed (new button visible)
- [ ] Manual test TC-SP-002-001 passes with new approval flow
- [ ] No critical errors in Supabase logs
- [ ] Admin can see new "Starter Pack" column
- [ ] Admin can click "Approve Listing" button
- [ ] Approval creates notification in admin_notifications table

---

## 📝 Next Steps (After Deployment)

1. **Immediate:** Test SP wallet fix (free → Kids Club+ upgrade)
2. **Today:** Run TC-SP-002-001 with new approval workflow
3. **Today:** Verify admin notifications appear
4. **Tomorrow:** Run full SP-002 test suite (all 4 test cases)
5. **Tomorrow:** Update manual test guide based on real testing
6. **Later:** Add notification bell to admin navbar (not blocking)

---

## 🎉 Success Criteria

| Item | Expected | Status |
|------|----------|--------|
| Migration 095 applies | No errors | ✅ Ready |
| Migration 096 applies | No errors | ✅ Ready |
| SP wallet initializes | No "column status" error | ✅ Ready to test |
| Admin can approve | Button works, status changes | ✅ Ready to test |
| Starter Pack badge shows | "🎁 Eligible" or "🎁 Claimed" | ✅ Ready to test |
| Test case TC-SP-002-001 passes | Admin approval workflow works | ✅ Ready to test |

---

**Deployment Ready:** ✅ YES  
**Estimated Deployment Time:** 5 minutes  
**Next Deployment Date:** [Schedule with Samer]

