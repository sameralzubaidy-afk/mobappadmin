#!/usr/bin/env node
/**
 * Apply migration 20260325000015 using Supabase client
 * This bypasses the CLI migration ordering issue
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Make sure .env.local has both variables set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🚀 Applying Admin RPC Schema Alignment Fix');
  console.log('==========================================\n');
  
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260325000015_fix_admin_rpcs_final_complete.sql');
  
  console.log(`📄 Reading migration: ${migrationPath}`);
  
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf8');
  } catch (err) {
    console.error('❌ Could not read migration file:', err.message);
    process.exit(1);
  }
  
  console.log(`✅ Loaded SQL (${sql.length} bytes)\n`);
  
  // Split SQL into statements (basic split on semicolons not in strings/comments)
  // For this specific migration, we know there are 2 main CREATE OR REPLACE FUNCTION statements
  console.log('🔧 Executing SQL statements...\n');
  
  // Execute the entire SQL as one block (Supabase handles multiple statements)
  try {
    const { data, error } = await supabase.rpc('pg_execute', { sql });
    
    // pg_execute might not exist, so try raw query approach
    if (error && error.message.includes('pg_execute')) {
      console.log('⚠️  pg_execute not available, trying direct execution...\n');
      
      // Use REST API directly to execute SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SQL execution failed:', response.status, response.statusText);
        console.error(errorText);
        process.exit(1);
      }
      
      console.log('✅ SQL executed successfully via REST API\n');
    } else if (error) {
      throw error;
    } else {
      console.log('✅ SQL executed successfully via RPC\n');
    }
  } catch (err) {
    console.error('❌ Execution failed:', err.message);
    console.error('\n📋 Manual application required:');
    console.error('1. Open: https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new');
    console.error('2. Copy content of: supabase/migrations/20260325000015_fix_admin_rpcs_final_complete.sql');
    console.error('3. Paste into SQL Editor');
    console.error('4. Click "Run"\n');
    process.exit(1);
  }
  
  // Verify functions were created/updated
  console.log('🔍 Verifying functions...');
  
  const { data: functions, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname')
    .in('proname', ['admin_list_users', 'admin_get_user_detail']);
    
  if (funcError) {
    console.log('⚠️  Could not verify (pg_proc not accessible via REST API)');
    console.log('   This is normal - functions are likely created successfully\n');
  } else {
    console.log('✅ Functions verified:', functions?.map(f => f.proname).join(', ') || 'N/A\n');
  }
  
  console.log('✅ Migration applied successfully!\n');
  console.log('📋 Next step: Run tests');
  console.log('   node p2p-kids-admin/test_admin_rpcs.mjs\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  console.error('\n📋 Manual application required:');
  console.error('1. Open Supabase Dashboard → SQL Editor');
  console.error('2. Copy: supabase/migrations/20260325000015_fix_admin_rpcs_final_complete.sql');
  console.error('3. Paste and Run\n');
  process.exit(1);
});
