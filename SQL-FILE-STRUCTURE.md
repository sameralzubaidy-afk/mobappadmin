# SQL File Structure Reference

**File:** MODULE-03-AUTH-V2-SETUP.sql

This file is organized in 7 parts. You can run them:
- ✅ **All at once** (recommended) - Copy entire file and run
- ✅ **One part at a time** - If you want to debug

---

## 📖 File Structure

```
MODULE-03-AUTH-V2-SETUP.sql (single file to run)
│
├─ PART 1: CREATE SUBSCRIPTIONS TABLE (Lines 1-80)
│  ├─ Table: subscriptions
│  ├─ Indexes: 3 indexes
│  ├─ RLS: 2 policies (SELECT, INSERT)
│  └─ Trigger: auto-update updated_at
│
├─ PART 2: CREATE SP_WALLETS TABLE (Lines 81-160)
│  ├─ Table: sp_wallets
│  ├─ Indexes: 2 indexes
│  ├─ RLS: 2 policies (SELECT, INSERT)
│  └─ Trigger: auto-update updated_at
│
├─ PART 3: ADD V2 FIELDS TO PROFILES (Lines 161-185)
│  ├─ Columns: 5 new columns added
│  └─ Indexes: 3 new indexes on profiles
│
├─ PART 4: RPC FUNCTIONS (Lines 186-350)
│  ├─ create_trial_subscription()
│  ├─ initialize_sp_wallet()
│  ├─ get_subscription_summary()
│  ├─ get_user_sp_wallet_summary()
│  ├─ is_trial_enabled()
│  └─ get_trial_duration_days()
│
├─ PART 5: CREATE ADMIN_CONFIG TABLE (Lines 351-400)
│  ├─ Table: admin_config
│  ├─ Indexes: 2 indexes
│  ├─ RLS: 2 policies (admin-only)
│  └─ Trigger: auto-update updated_at
│
├─ PART 6: INSERT DEFAULT CONFIGS (Lines 401-450)
│  ├─ trial_subscription config
│  ├─ swap_points_config
│  └─ feature_flags
│
└─ PART 7: COMMENTS & VERIFICATION (Lines 451+)
   └─ Helpful comments for reference
```

---

## 🎯 Recommended Approach

### Option A: Run Everything (FASTEST)
```
1. Open Supabase SQL Editor
2. Copy ENTIRE MODULE-03-AUTH-V2-SETUP.sql
3. Paste into editor
4. Click Run
5. Wait 30-60 seconds
6. Done!
```

### Option B: Run One Part at a Time (DEBUGGING)
```
1. Part 1 (Subscriptions table) → Run → ✅ Check
2. Part 2 (SP Wallets table) → Run → ✅ Check
3. Part 3 (Add profiles columns) → Run → ✅ Check
4. Part 4 (Create functions) → Run → ✅ Check
5. Part 5 (Admin config table) → Run → ✅ Check
6. Part 6 (Insert defaults) → Run → ✅ Check
```

---

## ✅ What Each Part Creates

### PART 1: subscriptions Table
Creates table with:
- Columns: id, user_id, status, trial_start_date, trial_end_date, stripe_*
- Indexes: 3 (user_id, status, stripe_customer_id)
- RLS: 2 policies (users can view/insert own)
- Trigger: auto-update updated_at

**Test after:** `SELECT COUNT(*) FROM subscriptions;` → Should return: 0

---

### PART 2: sp_wallets Table  
Creates table with:
- Columns: id, user_id, status, available_balance, pending_balance, lifetime_*
- Indexes: 2 (user_id, status)
- RLS: 2 policies (users can view/insert own)
- Trigger: auto-update updated_at

**Test after:** `SELECT COUNT(*) FROM sp_wallets;` → Should return: 0

---

### PART 3: Profiles Columns
Adds 5 columns to existing profiles table:
- subscription_id (UUID) → Links to subscriptions table
- sp_wallet_id (UUID) → Links to sp_wallets table
- onboarding_completed_at (TIMESTAMPTZ)
- parental_consent_verified (BOOLEAN)
- age (INTEGER, 5-17)

Plus 3 indexes for fast lookups

**Test after:** 
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='profiles' AND column_name IN (
  'subscription_id', 'sp_wallet_id', 'onboarding_completed_at',
  'parental_consent_verified', 'age'
);
```
→ Should return: 5 rows

---

### PART 4: RPC Functions
Creates 6 functions:
1. `create_trial_subscription(user_id)` - Creates trial, respects admin duration
2. `initialize_sp_wallet(user_id)` - Creates wallet with 0 balance
3. `get_subscription_summary(user_id)` - Returns subscription status
4. `get_user_sp_wallet_summary(user_id)` - Returns wallet balance
5. `is_trial_enabled()` - Checks admin config (true/false)
6. `get_trial_duration_days()` - Gets duration from config (default 30)

**Test after:**
```sql
SELECT is_trial_enabled();  -- Should return: true
SELECT get_trial_duration_days();  -- Should return: 30
```

---

### PART 5: admin_config Table
Creates table with:
- Columns: id, config_key, config_value (JSONB), description, enabled
- Indexes: 2 (config_key, enabled)
- RLS: 2 policies (admin role only)
- Trigger: auto-update updated_at

**Test after:** `SELECT COUNT(*) FROM admin_config;` → Should return: 0 (before Part 6)

---

### PART 6: Default Configurations  
Inserts 3 configurations:

1. **trial_subscription**
   ```json
   {
     "enabled": true,
     "duration_days": 30,
     "description": "30-day no-card trial for new Kids Club+ subscribers"
   }
   ```

2. **swap_points_config**
   ```json
   {
     "enabled": true,
     "earning_enabled": true,
     "spending_enabled": true,
     "max_percent_payment": 50,
     "pending_days": 3,
     "expiry_days": 90
   }
   ```

3. **feature_flags**
   ```json
   {
     "apple_signin": true,
     "google_signin": true,
     "social_sharing": false,
     "referral_program": true,
     "donation_mode": true
   }
   ```

**Test after:** 
```sql
SELECT config_key, enabled FROM admin_config ORDER BY config_key;
```
→ Should return: 3 rows (all enabled=true)

---

## 🔍 Visual Summary

```
What runs in MODULE-03-AUTH-V2-SETUP.sql:

┌─────────────────────────────────────────────────────────┐
│ PART 1: Subscriptions Table                             │
├─────────────────────────────────────────────────────────┤
│ ✓ CREATE TABLE subscriptions                            │
│ ✓ CREATE 3 indexes                                      │
│ ✓ ALTER TABLE ENABLE RLS                               │
│ ✓ CREATE 2 RLS policies                                │
│ ✓ CREATE function for updated_at trigger               │
│ ✓ CREATE trigger                                        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ PART 2: SP Wallets Table                                │
├─────────────────────────────────────────────────────────┤
│ ✓ CREATE TABLE sp_wallets                              │
│ ✓ CREATE 2 indexes                                      │
│ ✓ ALTER TABLE ENABLE RLS                               │
│ ✓ CREATE 2 RLS policies                                │
│ ✓ CREATE function + trigger for updated_at             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ PART 3: Add Columns to Profiles                         │
├─────────────────────────────────────────────────────────┤
│ ✓ ALTER TABLE profiles ADD 5 columns                    │
│ ✓ CREATE 3 indexes                                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ PART 4: RPC Functions                                   │
├─────────────────────────────────────────────────────────┤
│ ✓ CREATE OR REPLACE create_trial_subscription           │
│ ✓ CREATE OR REPLACE initialize_sp_wallet               │
│ ✓ CREATE OR REPLACE get_subscription_summary           │
│ ✓ CREATE OR REPLACE get_user_sp_wallet_summary         │
│ ✓ CREATE OR REPLACE is_trial_enabled                   │
│ ✓ CREATE OR REPLACE get_trial_duration_days            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ PART 5: Admin Config Table                              │
├─────────────────────────────────────────────────────────┤
│ ✓ CREATE TABLE admin_config                            │
│ ✓ CREATE 2 indexes                                      │
│ ✓ ALTER TABLE ENABLE RLS                               │
│ ✓ CREATE 2 RLS policies (admin-only)                   │
│ ✓ CREATE function + trigger for updated_at             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ PART 6: Insert Default Configurations                   │
├─────────────────────────────────────────────────────────┤
│ ✓ INSERT trial_subscription config                      │
│ ✓ INSERT swap_points_config                            │
│ ✓ INSERT feature_flags                                  │
└─────────────────────────────────────────────────────────┘
                           ↓
                    ✅ COMPLETE!
```

---

## 🎯 Total Operations

- **Tables created:** 3 (subscriptions, sp_wallets, admin_config)
- **Columns added:** 5 (to profiles)
- **Indexes created:** 10+
- **Functions created:** 6
- **RLS policies:** 6
- **Triggers:** 3
- **Default configurations:** 3

---

## ⏱️ Execution Time

| Step | Time |
|------|------|
| Part 1-2 (Tables) | 5-10 seconds |
| Part 3 (Columns) | 2-3 seconds |
| Part 4 (Functions) | 5-10 seconds |
| Part 5 (Admin table) | 2-3 seconds |
| Part 6 (Defaults) | 1-2 seconds |
| **Total** | **15-30 seconds** |

---

## ✅ Success = All 7 Parts Complete

When you click Run on the entire file:
- ✅ All parts execute sequentially
- ✅ All statements should complete with no errors
- ✅ Takes ~30 seconds total
- ✅ Ready to verify

---

**Next:** Copy MODULE-03-AUTH-V2-SETUP.sql and paste into Supabase SQL Editor, then Run!
