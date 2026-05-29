// PROD-010 — Tests for verifyAdminAuth() middleware.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const getUserMock = vi.fn();
const rpcMock = vi.fn();
const createClientMock = vi.fn(() => ({
  auth: { getUser: getUserMock },
  rpc: rpcMock,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

// Import AFTER mock registration.
import { verifyAdminAuth } from '../adminAuth';

function makeReq(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/admin/test', {
    method: 'GET',
    headers,
  });
}

describe('verifyAdminAuth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_UI_SECRET = 'super-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    getUserMock.mockReset();
    rpcMock.mockReset();
    createClientMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns unauthorized when no auth headers are present', async () => {
    const result = await verifyAdminAuth(makeReq({}));
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/no valid authentication/i);
  });

  it('authorizes when x-admin-secret matches ADMIN_UI_SECRET', async () => {
    const result = await verifyAdminAuth(
      makeReq({ 'x-admin-secret': 'super-secret' })
    );
    expect(result.authorized).toBe(true);
    expect(result.adminId).toBe('admin-secret');
  });

  it('rejects when x-admin-secret is present but wrong (no silent fallthrough)', async () => {
    const result = await verifyAdminAuth(
      makeReq({ 'x-admin-secret': 'wrong' })
    );
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/invalid admin secret/i);
  });

  it('rejects bearer token when getUser returns error', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad jwt' },
    });
    const result = await verifyAdminAuth(
      makeReq({ authorization: 'Bearer some.jwt.token' })
    );
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/invalid or expired session/i);
  });

  it('rejects bearer token when is_admin RPC returns false', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    rpcMock.mockResolvedValue({ data: false, error: null });
    const result = await verifyAdminAuth(
      makeReq({ authorization: 'Bearer some.jwt.token' })
    );
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/not an admin/i);
  });

  it('authorizes bearer token when is_admin RPC returns true', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    rpcMock.mockResolvedValue({ data: true, error: null });
    const result = await verifyAdminAuth(
      makeReq({ authorization: 'Bearer some.jwt.token' })
    );
    expect(result.authorized).toBe(true);
    expect(result.adminId).toBe('user-1');
  });

  it('does not consider NEXT_PUBLIC_ADMIN_UI_SECRET as a fallback', async () => {
    delete process.env.ADMIN_UI_SECRET;
    process.env.NEXT_PUBLIC_ADMIN_UI_SECRET = 'public-secret';
    const result = await verifyAdminAuth(
      makeReq({ 'x-admin-secret': 'public-secret' })
    );
    // With ADMIN_UI_SECRET unset, presented secret cannot match — no method-2 fallthrough.
    expect(result.authorized).toBe(false);
  });
});
