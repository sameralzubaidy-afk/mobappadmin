#!/usr/bin/env node
/**
 * Test Admin User Management RPCs after schema alignment fixes
 * Run this AFTER applying the latest admin RPC hotfix migration(s)
 * 
 * Usage: node test_admin_rpcs.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_BEARER_TOKEN = process.env.ADMIN_BEARER_TOKEN || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAdminUser() {
  console.log('🔍 Finding admin user...');
  
  const { data, error } = await supabase
    .from('role_based_access_control')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .single();
  
  if (error) {
    console.error('❌ Could not find admin user:', error.message);
    return null;
  }
  
  console.log(`✅ Found admin user: ${data.user_id}`);
  return data.user_id;
}

async function testAdminListUsers(adminId) {
  console.log('\n📋 Testing admin_list_users RPC...');
  
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_admin_id: adminId,
    p_search: null,
    p_account_status: null,
    p_subscription_status: null,
    p_node_id: null,
    p_page: 1,
    p_page_size: 5
  });
  
  if (error) {
    console.error('❌ admin_list_users failed:', error.message);
    console.error('   Hint:', error.hint);
    console.error('   Details:', error.details);
    return false;
  }
  
  console.log('✅ admin_list_users SUCCESS');
  console.log(`   Total users: ${data.total}`);
  console.log(`   Returned: ${data.users?.length || 0} users`);
  
  if (data.users && data.users.length > 0) {
    const firstUser = data.users[0];
    console.log('   Sample user fields:', Object.keys(firstUser).join(', '));
    
    // Verify key fields exist
    const requiredFields = ['id', 'name', 'email', 'sp_balance', 'trade_count', 'badge_count'];
    const missingFields = requiredFields.filter(f => !(f in firstUser));
    
    if (missingFields.length > 0) {
      console.error(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    console.log(`   ✅ All required fields present`);
    console.log(`   Sample data: SP=${firstUser.sp_balance}, Trades=${firstUser.trade_count}, Badges=${firstUser.badge_count}`);
  }
  
  return true;
}

async function testAdminGetUserDetail(adminId, userId) {
  console.log('\n🔍 Testing admin_get_user_detail RPC...');
  
  const { data, error } = await supabase.rpc('admin_get_user_detail', {
    p_admin_id: adminId,
    p_user_id: userId
  });
  
  if (error) {
    console.error('❌ admin_get_user_detail failed:', error.message);
    console.error('   Hint:', error.hint);
    console.error('   Details:', error.details);
    return false;
  }
  
  console.log('✅ admin_get_user_detail SUCCESS');
  console.log('   Sections:', Object.keys(data).join(', '));
  
  // Verify sp_wallet has correct fields
  if (data.sp_wallet) {
    const walletFields = Object.keys(data.sp_wallet);
    console.log('   SP Wallet fields:', walletFields.join(', '));
    
    const requiredWalletFields = ['available_balance', 'pending_balance', 'status'];
    const missingWalletFields = requiredWalletFields.filter(f => !walletFields.includes(f));
    
    if (missingWalletFields.length > 0) {
      console.error(`   ⚠️  Missing wallet fields: ${missingWalletFields.join(', ')}`);
      return false;
    }
    
    console.log(`   ✅ SP wallet has all required fields`);
  }
  
  // Verify trade_activity exists
  if (data.trade_activity) {
    console.log('   Trade activity:', JSON.stringify(data.trade_activity, null, 2));
  }
  
  // Verify badges exist (even if empty array)
  if (data.badges !== undefined) {
    console.log(`   ✅ Badges field present (count: ${data.badges?.length || 0})`);
  }
  
  return true;
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API endpoints...');

  if (!ADMIN_BEARER_TOKEN) {
    console.log('⚠️  Skipping API endpoint tests (set ADMIN_BEARER_TOKEN to enable)');
    return null;
  }
  
  try {
    const headers = {
      Authorization: `Bearer ${ADMIN_BEARER_TOKEN}`,
    };

    // Test users list endpoint
    const usersRes = await fetch('http://localhost:3001/api/admin/users?page=1&page_size=5', {
      headers,
    });
    const usersStatus = usersRes.status;
    
    if (usersStatus !== 200) {
      console.error(`❌ /api/admin/users returned ${usersStatus}`);
      const errorText = await usersRes.text();
      console.error('   Error:', errorText.substring(0, 200));
      return false;
    }
    
    const usersData = await usersRes.json();
    console.log('✅ /api/admin/users returned 200');
    console.log(`   Users count: ${usersData.users?.length || 0}`);
    
    // Test analytics endpoint
    const analyticsRes = await fetch('http://localhost:3001/api/admin/users/analytics', {
      headers,
    });
    const analyticsStatus = analyticsRes.status;
    
    if (analyticsStatus !== 200) {
      console.error(`❌ /api/admin/users/analytics returned ${analyticsStatus}`);
      return false;
    }
    
    const analyticsData = await analyticsRes.json();
    console.log('✅ /api/admin/users/analytics returned 200');
    console.log('   Analytics:', JSON.stringify(analyticsData, null, 2));
    
    return true;
  } catch (err) {
    console.error('❌ API test failed:', err.message);
    console.log('   Make sure admin portal is running: cd p2p-kids-admin && npm run dev');
    return false;
  }
}

async function main() {
  console.log('🚀 Admin RPC Schema Alignment Test');
  console.log('====================================\n');
  
  const adminId = await findAdminUser();
  if (!adminId) {
    console.error('\n❌ Cannot proceed without admin user');
    process.exit(1);
  }
  
  // Test RPC 1: admin_list_users
  const listUsersOk = await testAdminListUsers(adminId);
  
  // Get a sample user for detailed test
  let sampleUserId = null;
  if (listUsersOk) {
    const { data } = await supabase.rpc('admin_list_users', {
      p_admin_id: adminId,
      p_page: 1,
      p_page_size: 1
    });
    
    if (data && data.users && data.users.length > 0) {
      sampleUserId = data.users[0].user_id;
    }
  }
  
  // Test RPC 2: admin_get_user_detail
  let userDetailOk = false;
  if (sampleUserId) {
    userDetailOk = await testAdminGetUserDetail(adminId, sampleUserId);
  } else {
    console.log('\n⚠️  Skipping admin_get_user_detail test (no users found)');
  }
  
  // Test API endpoints
  const apiOk = await testAPIEndpoints();
  
  // Summary
  console.log('\n====================================');
  console.log('📊 Test Summary\n');
  console.log(`${listUsersOk ? '✅' : '❌'} admin_list_users RPC`);
  console.log(`${userDetailOk ? '✅' : '❌'} admin_get_user_detail RPC`);
  console.log(
    `${apiOk === null ? '⚠️' : apiOk ? '✅' : '❌'} API endpoints ${apiOk === null ? '(skipped - missing ADMIN_BEARER_TOKEN)' : ''}`
  );
  
  if (listUsersOk && userDetailOk && (apiOk === null || apiOk)) {
    console.log('\n🎉 All tests passed! Users page should load without errors.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
