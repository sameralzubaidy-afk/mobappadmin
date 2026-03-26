// filepath: p2p-kids-admin/src/__tests__/e2e/sp-wallet-admin.e2e.ts
// Module: MODULE-12-ADMIN-V2 / TASK ADMIN-V2-003
// Integration/E2E tests against Supabase prod (service role)
// Run: RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=sp-wallet-admin

import { createClient } from '@supabase/supabase-js';

const RUN_E2E = process.env.RUN_SUPABASE_E2E === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function maybeDescribe(name: string, fn: () => void) {
  if (RUN_E2E) {
    return describe(name, fn);
  }
  return describe.skip(`[skipped – set RUN_SUPABASE_E2E=true] ${name}`, fn);
}

maybeDescribe('ADMIN-V2-003 SP Wallet E2E (Supabase prod)', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  let walletId: string;

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    }
    supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find a test user with an existing sp_wallet
    const { data: wallets } = await supabase
      .from('sp_wallets')
      .select('id, user_id, available_balance')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!wallets) throw new Error('No sp_wallets row found in DB – cannot run E2E tests');

    testUserId = wallets.user_id;
    walletId = wallets.id;
    console.log(`E2E: using user_id=${testUserId} wallet_id=${walletId}`);
  });

  // ─── get_sp_economy_metrics ───────────────────────────────────────────────

  it('get_sp_economy_metrics returns expected keys', async () => {
    const { data, error } = await supabase.rpc('get_sp_economy_metrics');
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(typeof data.total_earned).toBe('number');
    expect(typeof data.total_spent).toBe('number');
    expect(typeof data.current_circulation).toBe('number');
    expect(typeof data.active_wallets).toBe('number');
    expect(typeof data.avg_balance).toBe('number');
    expect(typeof data.admin_adjustments_count).toBe('number');
    expect(typeof data.admin_adjustments_total).toBe('number');
  });

  it('get_sp_economy_metrics active_wallets >= 1 (test user exists)', async () => {
    const { data } = await supabase.rpc('get_sp_economy_metrics');
    expect(data.active_wallets).toBeGreaterThanOrEqual(1);
  });

  // ─── admin_get_sp_wallet_detail ───────────────────────────────────────────

  it('admin_get_sp_wallet_detail returns wallet for existing user', async () => {
    const { data, error } = await supabase.rpc('admin_get_sp_wallet_detail', {
      p_user_id: testUserId,
    });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.wallet).toBeDefined();
    expect(data.wallet.user_id).toBe(testUserId);
    expect(Array.isArray(data.ledger)).toBe(true);
  });

  it('admin_get_sp_wallet_detail returns error for non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const { data, error } = await supabase.rpc('admin_get_sp_wallet_detail', {
      p_user_id: fakeId,
    });
    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  // ─── admin_adjust_sp_wallet ───────────────────────────────────────────────

  it('admin_adjust_sp_wallet – adds 5 SP and creates ledger entry', async () => {
    const { data: before } = await supabase
      .from('sp_wallets')
      .select('available_balance')
      .eq('id', walletId)
      .single();

    const prevBalance = before?.available_balance ?? 0;

    const { data, error } = await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: 5,
      p_reason: 'E2E test add',
      p_admin_notes: 'Automated E2E test +5',
      p_actor_id: null,
    });

    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.new_balance).toBe(prevBalance + 5);
    expect(data.ledger_entry_id).toBeTruthy();

    // Verify ledger entry in DB
    const { data: ledger } = await supabase
      .from('sp_ledger')
      .select('id, transaction_type, amount')
      .eq('id', data.ledger_entry_id)
      .single();

    expect(ledger?.transaction_type).toBe('earn_admin_grant');
    expect(ledger?.amount).toBe(5);

    // Clean up: deduct back the 5 SP we added
    await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: -5,
      p_reason: 'E2E cleanup – reversal of +5',
      p_admin_notes: null,
      p_actor_id: null,
    });
  });

  it('admin_adjust_sp_wallet – rejects deduction below zero balance', async () => {
    const { data, error } = await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: -9999999,
      p_reason: 'Should fail',
      p_admin_notes: null,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Insufficient balance');
  });

  it('admin_adjust_sp_wallet – rejects empty reason', async () => {
    const { data, error } = await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: 1,
      p_reason: '',
      p_admin_notes: null,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Reason is mandatory');
  });

  // ─── admin_toggle_sp_wallet_status ───────────────────────────────────────

  it('admin_toggle_sp_wallet_status – freezes and unfreezes wallet', async () => {
    const freezeResult = await supabase.rpc('admin_toggle_sp_wallet_status', {
      p_user_id: testUserId,
      p_new_status: 'frozen',
      p_admin_notes: 'E2E freeze test',
      p_actor_id: null,
    });

    expect(freezeResult.error).toBeNull();
    expect(freezeResult.data.success).toBe(true);
    expect(freezeResult.data.new_status).toBe('frozen');

    // Restore to active
    const unfreezeResult = await supabase.rpc('admin_toggle_sp_wallet_status', {
      p_user_id: testUserId,
      p_new_status: 'active',
      p_admin_notes: 'E2E unfreeze – cleanup',
      p_actor_id: null,
    });

    expect(unfreezeResult.error).toBeNull();
    expect(unfreezeResult.data.success).toBe(true);
    expect(unfreezeResult.data.new_status).toBe('active');
  });

  it('admin_toggle_sp_wallet_status – rejects invalid status', async () => {
    const { data, error } = await supabase.rpc('admin_toggle_sp_wallet_status', {
      p_user_id: testUserId,
      p_new_status: 'deleted',
      p_admin_notes: null,
      p_actor_id: null,
    });

    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid status');
  });

  // ─── admin_audit_logs ─────────────────────────────────────────────────────

  it('admin_adjust_sp_wallet – creates audit log entry', async () => {
    const before = new Date();

    await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: 1,
      p_reason: 'Audit log E2E test',
      p_admin_notes: null,
      p_actor_id: null,
    });

    const { data: logs } = await supabase
      .from('admin_audit_logs')
      .select('id, action_type, entity_type, payload')
      .eq('action_type', 'sp_adjustment')
      .gte('created_at', before.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    expect(logs?.length).toBeGreaterThanOrEqual(1);
    expect(logs?.[0].entity_type).toBe('sp_wallet');
    expect(logs?.[0].payload?.user_id).toBe(testUserId);

    // Clean up: deduct the +1 we added
    await supabase.rpc('admin_adjust_sp_wallet', {
      p_user_id: testUserId,
      p_amount: -1,
      p_reason: 'Audit log E2E cleanup',
      p_admin_notes: null,
      p_actor_id: null,
    });
  });
});
