# 🔧 SP-002 Bug Fix: QUICK FIX INSTRUCTIONS

**Error:** "column 'status' of relation 'sp_wallets' does not exist"  
**When:** User upgrades free account to Kids Club+  
**Status:** ✅ FIXED

---

## ⚡ Quick Fix (2 steps)

### Step 1: Apply Migration

**Using Supabase CLI:**
```bash
cd p2p-kids-marketplace
supabase db reset
```

**Using Supabase Studio (SQL Editor):**
1. Go to https://supabase.com/dashboard → SQL Editor
2. Open: `supabase/migrations/095_fix_sp_wallet_column_rename.sql`
3. Copy all contents
4. Paste in SQL Editor
5. Click **Run**

### Step 2: Verify Fix

**SQL Verification (run in SQL Editor):**
```sql
-- Check that function exists with correct column name
SELECT initialize_sp_wallet('550e8400-e29b-41d4-a716-446655440000'::UUID);

-- Should return: A row with state = 'active' (no error)
```

**App Verification:**
1. Create new free account or use existing
2. Go to subscription choice screen
3. Tap "Try Kids Club+"
4. Should complete without error
5. Check "My Swap Points" - should show wallet initialized

---

## 📋 What Was Fixed

| Item | Before | After |
|------|--------|-------|
| **Column Name** | `status` (wrong) | `state` (correct) |
| **Error** | ❌ Column doesn't exist | ✅ No error |
| **User Action** | ❌ Upgrade fails | ✅ Upgrade succeeds |
| **Wallet** | ❌ Not created | ✅ Created with state='active' |

---

## 🧪 Testing Checklist

After applying migration 095:

- [ ] Typecheck passes: `yarn typecheck`
- [ ] Function exists in database
- [ ] Test SQL query above returns wallet row
- [ ] Free → Subscriber upgrade works in app
- [ ] No error dialogs appear
- [ ] "My Swap Points" screen loads
- [ ] Wallet shows available_balance = 0

---

## 📁 Files Changed

1. **CREATED:** `supabase/migrations/095_fix_sp_wallet_column_rename.sql`
   - New migration that fixes the RPC function
   - Recreates `initialize_sp_wallet()` with correct column name

2. **CREATED:** `SP-002-BUG-FIX-GUIDE.md` (detailed guide)

3. **CREATED:** `SP-002-BUG-FIX-ANALYSIS.md` (full analysis)

---

## 🆘 Troubleshooting

**Error still appears after migration:**
- Clear app cache: `rm -rf node_modules; yarn install`
- Restart simulator/emulator
- Verify migration ran: Check Supabase dashboard → Database → Migrations

**Migration fails to run:**
- Check Supabase logs for specific error
- Verify `sp_wallets` table exists with `state` column
- Run verification query to check schema

**Wallet not visible after upgrade:**
- Refresh app screen
- Re-open SP Wallet screen
- Check browser console for errors

---

## 📞 Support

If still having issues:
1. Check the full analysis: `SP-002-BUG-FIX-ANALYSIS.md`
2. Review manual test guide: `SP-002-MANUAL-TEST-GUIDE.md`
3. Check database schema in Supabase Studio

---

**Status:** Ready to deploy ✅
