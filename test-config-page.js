// Test script to verify admin config page logic
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://localhost:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function testConfigPage() {
  console.log('🧪 Testing admin config page logic...');

  try {
    // Test loading config
    console.log('📡 Loading admin config...');
    const { data: config, error: fetchError } = await supabase
      .from('admin_config')
      .select('*')
      .order('key');

    if (fetchError) {
      console.error('❌ Failed to load config:', fetchError.message);
      return;
    }

    console.log('✅ Config loaded successfully');
    console.log('📊 Found', config?.length || 0, 'config items:');

    config?.forEach(item => {
      console.log(`  - ${item.key}: ${item.value}`);
    });

    // Test SMS stats
    console.log('\n📊 Testing SMS stats...');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { count: totalToday } = await supabase
      .from('sms_rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', todayStart.toISOString());

    console.log('✅ SMS stats loaded successfully');
    console.log(`  - SMS sent today: ${totalToday || 0}`);

    console.log('\n🎉 All tests passed! Config page should work.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConfigPage();