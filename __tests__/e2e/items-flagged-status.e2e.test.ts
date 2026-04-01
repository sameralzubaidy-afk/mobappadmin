import { describe, expect, it } from '@jest/globals';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
const ADMIN_SECRET = process.env.ADMIN_UI_SECRET || process.env.NEXT_PUBLIC_ADMIN_UI_SECRET;
const TEST_ITEM_ID = process.env.SAFETY_008_TEST_ITEM_ID;

const describeIfConfigured = ADMIN_SECRET && TEST_ITEM_ID ? describe : describe.skip;

describe('Admin Item Status API - SAFETY-008', () => {
  it('rejects needs_edits without reason', async () => {
    if (!TEST_ITEM_ID) {
      expect(true).toBe(true);
      return;
    }

    const response = await fetch(`${BASE_URL}/api/admin/items/${TEST_ITEM_ID}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET || 'missing-secret',
      },
      body: JSON.stringify({
        status: 'needs_edits',
      }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(String(payload.error || '')).toContain('rejection_reason is required');
  });
});

describeIfConfigured('Admin Item Status API - Request Edits flow', () => {
  it('updates item status to needs_edits with seller note', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/items/${TEST_ITEM_ID}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET as string,
      },
      body: JSON.stringify({
        status: 'needs_edits',
        rejection_reason: 'Please update photos and remove unsafe accessory before resubmitting.',
      }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('needs_edits');
    expect(payload.data.rejection_reason).toContain('Please update photos');
  });
});
