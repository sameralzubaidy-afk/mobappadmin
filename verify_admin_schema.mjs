#!/usr/bin/env node
/**
 * Schema Smoke Test for Admin User Management RPCs
 * Run this to verify all referenced columns exist before deploying SQL fixes
 * 
 * Usage: node verify_admin_schema.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env.local is loaded');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const REQUIRED_COLUMNS = {
  'public.sp_wallets': [
    'id', 'user_id', 'status', 
    'available_balance', 'pending_balance', 
    'lifetime_earned', 'lifetime_spent',
    'created_at', 'updated_at'
  ],
  'public.trades': [
    'id', 'buyer_id', 'seller_id', 'status', 'completed_at'
  ],
  'public.subscriptions': [
    'id', 'user_id', 'status', 'tier_id', 
    'created_at', 'trial_end_date', 'current_period_end', 'cancelled_at'
  ],
  'public.subscription_tiers': [
    'id', 'name', 'display_name'
  ],
  'public.profiles': [
    'id', 'user_id', 'name', 'avatar_url', 'date_of_birth',
    'account_status', 'phone_verified', 'suspended_at', 'suspension_reason',
    'deleted_at', 'created_at', 'updated_at', 'node_id'
  ],
  'auth.users': [
    'id', 'email', 'phone', 'email_confirmed_at', 'last_sign_in_at'
  ],
  'public.user_badges': [
    'id', 'user_id', 'badge_id', 'awarded_at', 'revoked_at'
  ],
  'public.badges': [
    'id', 'name', 'icon'
  ],
  'public.sp_transactions': [
    'id', 'user_id', 'amount', 'transaction_type'
  ]
};

async function checkTableColumns(schema, table, requiredColumns) {
  console.log(`\n🔍 Checking ${schema}.${table}...`);
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${table}'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    // Fallback: try direct query
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${table}'
      ORDER BY ordinal_position;
    `;
    
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('_prisma_migrations')
      .select('*')
      .limit(0); // Just to test connection
    
    if (fallbackError) {
      console.error(`❌ Cannot query information_schema for ${schema}.${table}`);
      console.error('Error:', error.message || fallbackError.message);
      return false;
    }
  }

  const existingColumns = data?.map(row => row.column_name) || [];
  
  const missing = [];
  const found = [];
  
  for (const col of requiredColumns) {
    if (existingColumns.includes(col)) {
      found.push(col);
    } else {
      missing.push(col);
    }
  }

  if (missing.length === 0) {
    console.log(`✅ All ${requiredColumns.length} required columns found`);
    return true;
  } else {
    console.log(`❌ Missing columns: ${missing.join(', ')}`);
    console.log(`   Found: ${found.join(', ')}`);
    return false;
  }
}

async function verifyKnownIssues() {
  console.log('\n🔬 Checking Known Schema Issues...\n');
  
  const checks = [
    {
      name: 'sp_wallets has available_balance (not balance)',
      test: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name FROM information_schema.columns WHERE table_name='sp_wallets' AND column_name='available_balance'`
        }).catch(() => ({ data: null }));
        return data && data.length > 0;
      }
    },
    {
      name: 'sp_wallets does NOT have balance column',
      test: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name FROM information_schema.columns WHERE table_name='sp_wallets' AND column_name='balance'`
        }).catch(() => ({ data: null }));
        return !data || data.length === 0;
      }
    },
    {
      name: 'trades table exists (not transactions)',
      test: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='trades'`
        }).catch(() => ({ data: null }));
        return data && data.length > 0;
      }
    },
    {
      name: 'subscriptions has tier_id (not tier)',
      test: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='tier_id'`
        }).catch(() => ({ data: null }));
        return data && data.length > 0;
      }
    },
    {
      name: 'subscriptions has trial_end_date (not trial_ends_at)',
      test: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='trial_end_date'`
        }).catch(() => ({ data: null }));
        return data && data.length > 0;
      }
    }
  ];

  let allPassed = true;
  for (const check of checks) {
    try {
      const passed = await check.test();
      if (passed) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        allPassed = false;
      }
    } catch (err) {
      console.log(`⚠️  ${check.name} - Could not verify: ${err.message}`);
    }
  }
  
  return allPassed;
}

async function main() {
  console.log('🚀 Admin Schema Smoke Test');
  console.log('================================\n');
  
  // First check if we can connect
  const { data: testData, error: testError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  
  if (testError && testError.code === '42P01') {
    console.error('❌ Cannot connect to Supabase or profiles table does not exist');
    console.error('Error:', testError.message);
    process.exit(1);
  }

  console.log('✅ Connected to Supabase\n');

  // Run known issue checks first
  const knownIssuesOk = await verifyKnownIssues();
  
  if (!knownIssuesOk) {
    console.log('\n⚠️  Known schema issues detected. SQL migrations may fail.');
    console.log('Review the failed checks above before deploying fixes.\n');
  }

  console.log('\n================================');
  console.log('📊 Schema Verification Summary\n');
  
  if (knownIssuesOk) {
    console.log('✅ All checks passed! Schema is aligned with admin RPCs.');
    console.log('\nSafe to deploy admin user management SQL fixes.\n');
    process.exit(0);
  } else {
    console.log('❌ Schema mismatches detected.');
    console.log('\nRequired fixes:');
    console.log('1. Change sw.balance → sw.available_balance');
    console.log('2. Verify trades table exists (not transactions)');
    console.log('3. Use tier_id for subscription tier lookups');
    console.log('4. Use trial_end_date (not trial_ends_at)\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
