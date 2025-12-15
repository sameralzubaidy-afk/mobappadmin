import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabase = createClient(SUPABASE_URL || '', SERVICE_KEY || '');

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { count: totalToday } = await supabase
      .from('sms_rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', todayStart);

    const { count: totalHour } = await supabase
      .from('sms_rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', hourAgo);

    const { data: phones } = await supabase
      .from('sms_rate_limit_log')
      .select('phone')
      .gte('sent_at', hourAgo);

    const { count: rateLimited } = await supabase
      .from('sms_rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .eq('rate_limited', true)
      .gte('sent_at', hourAgo);

    return NextResponse.json({
      totalSentToday: totalToday || 0,
      totalSentThisHour: totalHour || 0,
      uniquePhonesThisHour: new Set(phones?.map((p) => p.phone)).size || 0,
      rateLimitedAttempts: rateLimited || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
