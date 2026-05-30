# SP-004 Cron Job Setup & Testing Guide

**Module:** MODULE-09-POINTS-GAMIFICATION-V2  
**Component:** SP-004 (SP Expiration System)  
**Last Updated:** 2026-01-25  
**Environment:** Supabase Production

---

## Overview

This guide covers setting up and testing **automated cron jobs** for the SP expiration system:

1. **Expiration Processing** - Marks expired SP batches and updates wallet balances
2. **Expiration Warnings** - Creates warning records for batches expiring soon

---

## Prerequisites

### Required Access
- ✅ Supabase project dashboard access
- ✅ Database admin privileges
- ✅ SQL Editor access in Supabase Studio

### Required Database Objects
Verify these exist before proceeding:

```sql
-- Check RPC functions exist
SELECT proname, proargnames 
FROM pg_proc 
WHERE proname IN (
  'process_sp_expiration',
  'send_sp_expiration_warnings',
  'get_user_expiration_warnings'
);

-- Expected output: 3 rows (all functions should exist)

-- Check sp_expiration_warnings table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'sp_expiration_warnings';

-- Expected output: 1 row

-- Check pg_cron extension is available
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Expected output: 1 row showing pg_cron extension
```

**If any checks fail:** Run migration `096_sp_expiration_processing.sql` first.

---

## Step 1: Enable pg_cron Extension

### 1.1 Enable Extension

```sql
-- Enable pg_cron extension (requires superuser or admin)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**Expected Output:**
```
 oid  | extname | extowner | extnamespace | extrelocatable | extversion 
------+---------+----------+--------------+----------------+------------
 XXXXX| pg_cron | XXXX     | XXXX         | f              | 1.x.x
```

### 1.2 Verify Cron Schema

```sql
-- Check cron schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cron';

-- Check cron.job table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'cron' AND table_name = 'job';
```

**If cron schema doesn't exist:** Contact Supabase support or check project tier (pg_cron may require Pro plan).

---

## Step 2: Schedule Expiration Processing Cron Job

### 2.1 Create Expiration Processing Job

This job runs **daily at midnight UTC** to process expired SP batches.

```sql
-- Schedule expiration processing (daily at 00:00 UTC)
SELECT cron.schedule(
  'sp-expiration-processing',           -- Job name
  '0 0 * * *',                          -- Cron expression: Daily at midnight
  $$SELECT process_sp_expiration()$$    -- SQL command to execute
);
```

**Expected Output:**
```
 schedule 
----------
       42
(1 row)
```
The number returned is the job ID.

### 2.2 Verify Job Scheduled

```sql
-- List all cron jobs
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'sp-expiration-processing';
```

**Expected Output:**
```
 jobid |  schedule  |                command                | active 
-------+------------+--------------------------------------+--------
    42 | 0 0 * * *  | SELECT process_sp_expiration()       | t
```

**Key Fields:**
- `schedule`: `0 0 * * *` means daily at midnight UTC
- `active`: `t` (true) means job is enabled
- `command`: The SQL that will execute

---

## Step 3: Schedule Warning Creation Cron Job

### 3.1 Create Warning Job

This job runs **daily at 9:00 AM UTC** to create expiration warnings.

```sql
-- Schedule warning creation (daily at 09:00 UTC)
SELECT cron.schedule(
  'sp-expiration-warnings',              -- Job name
  '0 9 * * *',                           -- Cron expression: Daily at 9am
  $$SELECT send_sp_expiration_warnings()$$ -- SQL command
);
```

**Expected Output:**
```
 schedule 
----------
       43
(1 row)
```

### 3.2 Verify Job Scheduled

```sql
-- List all SP-related cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname LIKE 'sp-%'
ORDER BY jobname;
```

**Expected Output:**
```
 jobid |         jobname           |  schedule  |                  command                   | active 
-------+---------------------------+------------+--------------------------------------------+--------
    42 | sp-expiration-processing  | 0 0 * * *  | SELECT process_sp_expiration()             | t
    43 | sp-expiration-warnings    | 0 9 * * *  | SELECT send_sp_expiration_warnings()       | t
```

---

## Step 4: Test Cron Jobs Manually

### 4.1 Create Test Data

Before testing, create test batches that should be processed:

```sql
-- Get your test user IDs
SELECT id, email FROM auth.users WHERE email LIKE '%test%' LIMIT 5;

-- Pick one user and get their wallet
SELECT id, user_id, available_balance 
FROM sp_wallets 
WHERE user_id = '[YOUR_TEST_USER_ID]';

-- Create expired batch (should be processed by expiration job)
INSERT INTO sp_batches (
  wallet_id,
  user_id,
  initial_sp,
  remaining_sp,
  source_type,
  expires_at,
  is_expired
) VALUES (
  '[WALLET_ID]',
  '[USER_ID]',
  100,
  100,
  'test',
  NOW() - INTERVAL '1 day',  -- Expired yesterday
  false                       -- Not yet marked as expired
);

-- Create batch expiring in 7 days (should trigger warning)
INSERT INTO sp_batches (
  wallet_id,
  user_id,
  initial_sp,
  remaining_sp,
  source_type,
  expires_at,
  is_expired
) VALUES (
  '[WALLET_ID]',
  '[USER_ID]',
  50,
  50,
  'test',
  NOW() + INTERVAL '7 days',  -- Expires in 7 days
  false
);

-- Verify test data created
SELECT id, remaining_sp, expires_at, is_expired, source_type
FROM sp_batches
WHERE user_id = '[USER_ID]'
ORDER BY expires_at;
```

### 4.2 Test Expiration Processing

```sql
-- Run expiration processing manually
SELECT * FROM process_sp_expiration();
```

**Expected Output:**
```json
{
  "success": true,
  "batches_expired": 1,
  "total_sp_expired": 100,
  "wallets_updated": 1,
  "ledger_entries_created": 1
}
```

**Verify Results:**

```sql
-- Check batch was marked as expired
SELECT id, remaining_sp, is_expired, expires_at
FROM sp_batches
WHERE user_id = '[USER_ID]'
AND source_type = 'test'
ORDER BY expires_at;

-- Expected: Expired batch should have is_expired = true

-- Check wallet balance was reduced
SELECT available_balance, lifetime_expired
FROM sp_wallets
WHERE user_id = '[USER_ID]';

-- Expected: available_balance reduced by 100, lifetime_expired increased by 100

-- Check ledger entry created
SELECT 
  transaction_type,
  amount,
  balance_after,
  related_batch_id,
  created_at
FROM sp_ledger
WHERE user_id = '[USER_ID]'
AND transaction_type = 'expire'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: New entry with amount = -100, transaction_type = 'expire'
```

### 4.3 Test Warning Creation

```sql
-- Run warning creation manually
SELECT * FROM send_sp_expiration_warnings();
```

**Expected Output:**
```json
{
  "success": true,
  "warnings_created": 1,
  "batches_checked": 2,
  "warning_types": ["7_day"]
}
```

**Verify Results:**

```sql
-- Check warning was created
SELECT 
  user_id,
  batch_id,
  warning_type,
  sp_amount,
  expires_at,
  notification_sent,
  created_at
FROM sp_expiration_warnings
WHERE user_id = '[USER_ID]'
ORDER BY created_at DESC;

-- Expected: New warning with warning_type = '7_day', notification_sent = false

-- Get warnings via RPC (same as app would call)
SELECT * FROM get_user_expiration_warnings('[USER_ID]');
```

**Expected Output:**
```json
[
  {
    "warning_id": "uuid",
    "batch_id": "uuid",
    "warning_type": "7_day",
    "sp_amount": 50,
    "expires_at": "2026-02-01T00:00:00Z",
    "days_until_expiry": 7,
    "notification_sent": false
  }
]
```

### 4.4 Test Duplicate Prevention

```sql
-- Run warning creation again (should not create duplicates)
SELECT * FROM send_sp_expiration_warnings();
```

**Expected Output:**
```json
{
  "success": true,
  "warnings_created": 0,    -- No new warnings (duplicate prevention)
  "batches_checked": 2,
  "warning_types": []
}
```

**Verify:**
```sql
-- Count warnings for the batch (should be exactly 1)
SELECT COUNT(*) 
FROM sp_expiration_warnings
WHERE user_id = '[USER_ID]'
AND warning_type = '7_day';

-- Expected: 1 (not 2)
```

---

## Step 5: Monitor Cron Job Execution

### 5.1 Check Recent Job Runs

```sql
-- View job run history (last 10 runs)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE 'sp-%'
)
ORDER BY start_time DESC
LIMIT 10;
```

**Columns Explained:**
- `status`: Should be `succeeded` (or `failed` if error)
- `return_message`: Error message if failed, or return value if succeeded
- `start_time`/`end_time`: Execution timestamps

### 5.2 Check for Failed Jobs

```sql
-- Find any failed job runs in last 7 days
SELECT 
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'sp-%'
AND jrd.status = 'failed'
AND jrd.start_time > NOW() - INTERVAL '7 days'
ORDER BY jrd.start_time DESC;
```

**If failures found:** Check `return_message` for error details.

### 5.3 Setup Monitoring Alert (Optional)

Create a view for easy monitoring:

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW sp_cron_health AS
SELECT 
  j.jobname,
  j.active,
  j.schedule,
  MAX(jrd.start_time) AS last_run,
  MAX(jrd.end_time) AS last_completed,
  COUNT(CASE WHEN jrd.status = 'failed' AND jrd.start_time > NOW() - INTERVAL '7 days' THEN 1 END) AS failures_last_7_days
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'sp-%'
GROUP BY j.jobid, j.jobname, j.active, j.schedule;

-- Query the view
SELECT * FROM sp_cron_health;
```

**Expected Output:**
```
        jobname           | active |  schedule  |      last_run       | failures_last_7_days 
--------------------------+--------+------------+---------------------+----------------------
 sp-expiration-processing | t      | 0 0 * * *  | 2026-01-25 00:00:01 | 0
 sp-expiration-warnings   | t      | 0 9 * * *  | 2026-01-25 09:00:01 | 0
```

---

## Step 6: Adjust Schedule (If Needed)

### 6.1 Change Cron Timing

If you need different execution times:

```sql
-- Example: Change expiration processing to 2:00 AM UTC instead of midnight
SELECT cron.schedule(
  'sp-expiration-processing',
  '0 2 * * *',  -- New schedule: 2am daily
  $$SELECT process_sp_expiration()$$
);

-- Note: This will UPDATE the existing job (not create a duplicate)
```

### 6.2 Cron Expression Reference

Common schedules:

```
'0 0 * * *'     - Daily at midnight UTC
'0 9 * * *'     - Daily at 9:00 AM UTC
'0 */6 * * *'   - Every 6 hours
'0 0 * * 0'     - Weekly on Sunday at midnight
'0 0 1 * *'     - Monthly on 1st day at midnight
'*/15 * * * *'  - Every 15 minutes
```

### 6.3 Disable/Enable Jobs

```sql
-- Disable a job (keeps it scheduled but won't run)
UPDATE cron.job
SET active = false
WHERE jobname = 'sp-expiration-warnings';

-- Re-enable a job
UPDATE cron.job
SET active = true
WHERE jobname = 'sp-expiration-warnings';

-- Verify status
SELECT jobname, active FROM cron.job WHERE jobname LIKE 'sp-%';
```

### 6.4 Delete a Job

```sql
-- Delete a cron job permanently
SELECT cron.unschedule('sp-expiration-processing');

-- Verify deleted
SELECT jobname FROM cron.job WHERE jobname = 'sp-expiration-processing';
-- Expected: 0 rows (job deleted)
```

**Warning:** Only delete if you're sure. You'll need to re-run `cron.schedule()` to recreate.

---

## Step 7: Production Verification Checklist

Before considering the cron setup complete:

### ✅ Pre-Deployment Checks
- [ ] Migration 096 applied successfully
- [ ] Both RPC functions exist and tested manually
- [ ] pg_cron extension enabled
- [ ] Test data processed correctly

### ✅ Cron Job Configuration
- [ ] `sp-expiration-processing` scheduled at `0 0 * * *`
- [ ] `sp-expiration-warnings` scheduled at `0 9 * * *`
- [ ] Both jobs show `active = true`
- [ ] Jobs running in correct database

### ✅ Testing
- [ ] Manual execution of `process_sp_expiration()` successful
- [ ] Manual execution of `send_sp_expiration_warnings()` successful
- [ ] Duplicate prevention verified
- [ ] Ledger entries created correctly
- [ ] Wallet balances updated correctly

### ✅ Monitoring
- [ ] Job run history shows recent executions
- [ ] No failed runs in past 7 days
- [ ] `sp_cron_health` view created for monitoring

### ✅ Documentation
- [ ] Cron schedules documented in project README
- [ ] Alert procedures documented for failures
- [ ] Rollback plan documented

---

## Step 8: Cleanup Test Data

After testing is complete, remove test batches:

```sql
-- Remove test batches (be careful with user_id filter!)
DELETE FROM sp_batches
WHERE user_id = '[YOUR_TEST_USER_ID]'
AND source_type = 'test';

-- Remove test warnings
DELETE FROM sp_expiration_warnings
WHERE user_id = '[YOUR_TEST_USER_ID]';

-- Verify cleanup
SELECT COUNT(*) FROM sp_batches WHERE source_type = 'test';
-- Expected: 0

SELECT COUNT(*) FROM sp_expiration_warnings WHERE user_id = '[YOUR_TEST_USER_ID]';
-- Expected: 0
```

---

## Troubleshooting

### Issue 1: pg_cron Extension Not Available

**Symptoms:**
```
ERROR:  extension "pg_cron" is not available
```

**Causes:**
- Supabase project on free tier (pg_cron may require Pro)
- Extension not installed in Supabase instance

**Solutions:**
1. Upgrade to Supabase Pro plan
2. Contact Supabase support to enable pg_cron
3. Alternative: Use Supabase Edge Functions with scheduled triggers

---

### Issue 2: Cron Job Not Executing

**Symptoms:**
- Job shows `active = true` but no runs in `cron.job_run_details`

**Diagnostic Steps:**
```sql
-- Check if cron daemon is running
SELECT cron.schedule('test-job', '* * * * *', 'SELECT 1');
-- Wait 2 minutes
SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'test-job') ORDER BY start_time DESC LIMIT 1;
-- If no results, cron daemon may not be running

-- Clean up test job
SELECT cron.unschedule('test-job');
```

**Solutions:**
- Verify `pg_cron` settings in Supabase dashboard
- Check database logs for cron errors
- Contact Supabase support

---

### Issue 3: RPC Function Fails During Cron Execution

**Symptoms:**
```sql
SELECT * FROM cron.job_run_details WHERE status = 'failed';
```
Shows errors like "permission denied" or "function does not exist"

**Diagnostic Steps:**
```sql
-- Check RPC function owner
SELECT proname, proowner, pronamespace 
FROM pg_proc 
WHERE proname = 'process_sp_expiration';

-- Check if function is in correct schema
SELECT n.nspname, p.proname 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE 'process_sp%';
```

**Solutions:**
1. Ensure RPC functions are in `public` schema
2. Grant execute permissions:
   ```sql
   GRANT EXECUTE ON FUNCTION process_sp_expiration() TO postgres;
   GRANT EXECUTE ON FUNCTION send_sp_expiration_warnings() TO postgres;
   ```
3. Re-apply migration 096 if functions are missing

---

### Issue 4: Jobs Running But Not Processing Data

**Symptoms:**
- Job runs show `succeeded` status
- But no batches are expired or warnings created

**Diagnostic Steps:**
```sql
-- Check if there's actually data to process
SELECT COUNT(*) FROM sp_batches WHERE expires_at < NOW() AND is_expired = false;
-- Expected: >0 if there should be expired batches

SELECT COUNT(*) FROM sp_batches 
WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
AND is_expired = false;
-- Expected: >0 if there should be warnings
```

**Solutions:**
- Verify test data exists with `expires_at` in the past
- Check that `sp_config` has correct values:
  ```sql
  SELECT * FROM sp_config WHERE config_key LIKE 'expiration%';
  ```
- Run functions manually and check JSONB output for clues

---

### Issue 5: Warnings Created Multiple Times

**Symptoms:**
- Multiple warning records for same batch/type

**Diagnostic:**
```sql
SELECT batch_id, warning_type, COUNT(*) 
FROM sp_expiration_warnings
GROUP BY batch_id, warning_type
HAVING COUNT(*) > 1;
```

**Solutions:**
- Check `DISTINCT ON` clause in `send_sp_expiration_warnings()` function
- Add unique constraint if missing:
  ```sql
  ALTER TABLE sp_expiration_warnings
  ADD CONSTRAINT sp_expiration_warnings_unique_batch_type
  UNIQUE (batch_id, warning_type);
  ```

---

## Performance Considerations

### Expected Execution Times

**At 1,000 users with SP:**
- `process_sp_expiration()`: ~1-2 seconds
- `send_sp_expiration_warnings()`: ~1-2 seconds

**At 10,000 users with SP:**
- `process_sp_expiration()`: ~5-10 seconds
- `send_sp_expiration_warnings()`: ~5-10 seconds

**At 100,000+ users with SP:**
- May need to batch process (add pagination to RPC functions)
- Consider running more frequently (e.g., every 6 hours with smaller batches)

### Monitoring Query Performance

```sql
-- Check average execution time
SELECT 
  j.jobname,
  AVG(EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))) AS avg_seconds,
  MAX(EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))) AS max_seconds,
  COUNT(*) AS total_runs
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'sp-%'
AND jrd.start_time > NOW() - INTERVAL '30 days'
GROUP BY j.jobname;
```

**Red Flags:**
- `avg_seconds > 30`: Consider optimization or batching
- `max_seconds > 60`: Investigate slow queries

---

## Alternative: Edge Function Scheduled Triggers

If `pg_cron` is not available, you can use Supabase Edge Functions with external scheduling:

### Option A: Supabase Scheduled Functions (Beta)

Check Supabase dashboard for "Edge Functions" → "Scheduled" (if available in your plan)

### Option B: External Cron Service

Use a service like:
- Cron-job.org
- EasyCron
- GitHub Actions scheduled workflows

Example GitHub Action:

```yaml
# .github/workflows/sp-expiration-cron.yml
name: SP Expiration Cron
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
jobs:
  run-expiration:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase RPC
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/process_sp_expiration" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

---

## Next Steps

After cron jobs are setup and tested:

1. **Monitor for 7 Days:** Watch `cron.job_run_details` for any failures
2. **Verify First Real Expiration:** Wait for actual SP batches to expire and verify processing
3. **Setup Alerts:** Configure notifications for cron failures (via Supabase webhooks or monitoring service)
4. **Document in README:** Add cron schedule info to project documentation
5. **Create Runbook:** Document incident response for cron failures

---

## Sign-Off Checklist

**Cron Jobs Setup:** ☐ COMPLETE  
**Manual Testing:** ☐ COMPLETE  
**Monitoring Setup:** ☐ COMPLETE  
**Documentation:** ☐ COMPLETE  

**Tested by:** _________________  
**Date:** _________________  
**Next Review Date:** _________________

---

**END OF CRON SETUP GUIDE**
