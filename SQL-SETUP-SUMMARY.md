# MODULE-03 AUTH-V2: SQL Files Summary

**Date:** December 16, 2025  
**Status:** ✅ READY TO RUN

---

## 📋 Files You Need

### 1. **MAIN SETUP SQL** (Run this first)
**File:** `MODULE-03-AUTH-V2-SETUP.sql`

**What it does:**
- Creates 3 tables: subscriptions, sp_wallets, admin_config
- Adds 5 new columns to profiles table
- Creates 6 RPC functions
- Enables Row-Level Security (RLS)
- Inserts default admin configurations

**How to run:**
1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Copy entire file contents
4. Paste into editor
5. Click Run (Cmd+Enter)
6. ⏱️ Takes ~30-60 seconds

---

### 2. **VERIFICATION QUERIES** (Run after setup)
**File:** `MODULE-03-AUTH-V2-VERIFY.sql`

**What it does:**
- Verifies all tables exist
- Checks all functions are created
- Confirms admin_config data loaded
- Tests RPC functions work
- Validates RLS policies

**How to use:**
1. In same SQL Editor
2. Copy one query at a time from verify file
3. Run each query
4. Check that results match expected output

---

### 3. **SETUP GUIDE** (Instructions)
**File:** `SUPABASE-SQL-SETUP-GUIDE.md`

**What it includes:**
- Step-by-step instructions
- What to do if you get errors
- Troubleshooting tips
- Verification checklist

---

## 🚀 Quick Start (3 Steps)

### Step 1: Run Setup SQL
```
Copy MODULE-03-AUTH-V2-SETUP.sql → Supabase SQL Editor → Run
```

### Step 2: Run Verification
```
Copy verification queries → Run each one → Check results
```

### Step 3: Confirm Success
```
All 10 verification queries pass → ✅ You're ready to test!
```

---

## 📊 What Gets Created

### Tables (3)
| Table | Purpose |
|-------|---------|
| **subscriptions** | Tracks user subscription (trial/active/grace/canceled) |
| **sp_wallets** | Tracks Swap Points balance, earned, spent |
| **admin_config** | Configuration table for trial settings, feature flags |

### Columns Added to profiles (5)
| Column | Type | Purpose |
|--------|------|---------|
| subscription_id | UUID | Links to subscription record |
| sp_wallet_id | UUID | Links to SP wallet record |
| onboarding_completed_at | TIMESTAMPTZ | When user finished onboarding |
| parental_consent_verified | BOOLEAN | COPPA compliance flag |
| age | INTEGER | User age (5-17) |

### Functions (6)
| Function | Purpose |
|----------|---------|
| `create_trial_subscription()` | Creates 30-day trial (respects admin duration) |
| `initialize_sp_wallet()` | Creates SP wallet with 0 balance |
| `get_subscription_summary()` | Fetches subscription status for session |
| `get_user_sp_wallet_summary()` | Fetches wallet balance for session |
| `is_trial_enabled()` | Checks if trial enrollment is allowed (admin control) |
| `get_trial_duration_days()` | Gets trial duration from admin_config |

### Admin Config (3 default settings)
1. **trial_subscription** - enabled=true, duration_days=30
2. **swap_points_config** - SP earning/spending rules
3. **feature_flags** - Feature toggles (apple_signin, google_signin, etc.)

---

## ✅ Verification Commands Cheat Sheet

### Check tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('subscriptions', 'sp_wallets', 'admin_config');
-- Expected: 3 rows
```

### Check functions exist:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'create_trial_subscription', 'initialize_sp_wallet', 
  'get_subscription_summary', 'get_user_sp_wallet_summary',
  'is_trial_enabled', 'get_trial_duration_days'
);
-- Expected: 6 rows
```

### Check admin config:
```sql
SELECT config_key, enabled FROM admin_config;
-- Expected: trial_subscription, swap_points_config, feature_flags (all enabled=true)
```

### Test trial functions:
```sql
SELECT is_trial_enabled();  -- Should return: true
SELECT get_trial_duration_days();  -- Should return: 30
```

---

## 🔧 If Something Goes Wrong

### Error: "Table already exists"
✅ **OK** - This is expected if you run setup twice. Just continue.

### Error: "Function already exists"  
✅ **OK** - The SQL uses `CREATE OR REPLACE`. Just continue.

### Error: "Relation profiles does not exist"
❌ **Action needed:**
1. Create profiles table first (see SUPABASE-SQL-SETUP-GUIDE.md)
2. Then run setup SQL again

### Functions not working
1. Check if they're listed: Go to Supabase → Database → Functions
2. If missing, run PART 4 of setup SQL again
3. Test with: `SELECT is_trial_enabled();`

---

## 📈 After Setup is Complete

**Your database is now ready for:**
- ✅ Running integration tests (`yarn test`)
- ✅ Testing signup flow in the app
- ✅ Testing trial enrollment with admin control
- ✅ Deploying to staging

**Next steps:**
1. Run tests: `yarn test`
2. Test signup flow in app
3. Verify trial enrollment works
4. Test admin config changes (disable trial, change duration)

---

## 📁 File Locations

All files in: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/`

```
├── MODULE-03-AUTH-V2-SETUP.sql              ← Main setup (run this)
├── MODULE-03-AUTH-V2-VERIFY.sql             ← Verification queries
├── SUPABASE-SQL-SETUP-GUIDE.md              ← Detailed instructions
├── MODULE-03-AUTH-V2-QUICK-START.md         ← Testing guide
└── MODULE-03-AUTH-V2-COMPLETE-VERIFICATION.md ← Full documentation
```

---

## ⏱️ Expected Timing

| Task | Time |
|------|------|
| Run setup SQL | 30-60 seconds |
| Run verification | 1-2 minutes |
| **Total** | **~2-3 minutes** |

---

## 🎯 Success Criteria

✅ Setup is successful when:
1. All tables exist (subscriptions, sp_wallets, admin_config)
2. All 6 functions exist
3. All verification queries return expected results
4. `is_trial_enabled()` returns `true`
5. `get_trial_duration_days()` returns `30`
6. admin_config has 3 entries (all enabled=true)

---

## 📞 Need Help?

1. Check SUPABASE-SQL-SETUP-GUIDE.md for troubleshooting
2. Look for error messages - they're usually clear
3. Try running one SQL section at a time (PART 1, PART 2, etc.)
4. If stuck, run the reset commands (see troubleshooting section)

---

**Status:** ✅ READY  
**Next Action:** Copy MODULE-03-AUTH-V2-SETUP.sql to Supabase SQL Editor and Run
