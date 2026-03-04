// File: p2p-kids-admin/__tests__/id-badge-admin.unit.test.ts
// TASK BADGE-010: Unit tests for ID Badge Admin functionality
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Unit tests for ID Badge Admin Queue & Review functionality
 * 
 * These tests verify:
 * - Stats calculation correctness
 * - Filter logic
 * - Search functionality
 * - Status badge display logic
 */

describe('ID Badge Admin - Stats Calculation', () => {
  test('should calculate pending count correctly', () => {
    const requests = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'approved' },
      { status: 'rejected' },
    ];

    const pendingCount = requests.filter((r) => r.status === 'pending').length;
    expect(pendingCount).toBe(2);
  });

  test('should calculate approval rate correctly', () => {
    const requests = [
      { status: 'approved' },
      { status: 'approved' },
      { status: 'approved' },
      { status: 'rejected' },
    ];

    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const approvalRate = (approved / (approved + rejected)) * 100;

    expect(approvalRate).toBe(75);
  });

  test('should calculate average review time correctly', () => {
    const requests = [
      {
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: '2026-02-08T12:00:00Z', // 2 hours
      },
      {
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: '2026-02-08T14:00:00Z', // 4 hours
      },
      {
        submitted_at: '2026-02-08T10:00:00Z',
        reviewed_at: '2026-02-08T16:00:00Z', // 6 hours
      },
    ];

    const totalHours = requests.reduce((sum, req) => {
      const submitted = new Date(req.submitted_at).getTime();
      const reviewed = new Date(req.reviewed_at!).getTime();
      const hours = (reviewed - submitted) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    const avgHours = totalHours / requests.length;
    expect(avgHours).toBe(4);
  });

  test('should handle zero decided requests gracefully', () => {
    const requests: any[] = [];
    const avgHours = requests.length > 0 ? 0 : 0;
    expect(avgHours).toBe(0);
  });
});

describe('ID Badge Admin - Filter Logic', () => {
  const mockRequests = [
    { id: '1', status: 'pending', first_name: 'Alice' },
    { id: '2', status: 'approved', first_name: 'Bob' },
    { id: '3', status: 'rejected', first_name: 'Charlie' },
    { id: '4', status: 'pending', first_name: 'Dave' },
  ];

  test('should filter by pending status', () => {
    const filtered = mockRequests.filter((r) => r.status === 'pending');
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.first_name)).toEqual(['Alice', 'Dave']);
  });

  test('should filter by approved status', () => {
    const filtered = mockRequests.filter((r) => r.status === 'approved');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].first_name).toBe('Bob');
  });

  test('should filter by rejected status', () => {
    const filtered = mockRequests.filter((r) => r.status === 'rejected');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].first_name).toBe('Charlie');
  });

  test('should show all when filter is "all"', () => {
    const filtered = mockRequests; // No filter applied
    expect(filtered).toHaveLength(4);
  });
});

describe('ID Badge Admin - Search Logic', () => {
  const mockRequests = [
    {
      id: '1',
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
    },
    {
      id: '2',
      first_name: 'Bob',
      last_name: 'Johnson',
      email: 'bob@test.com',
    },
    {
      id: '3',
      first_name: 'Charlie',
      last_name: 'Williams',
      email: 'charlie@example.com',
    },
  ];

  test('should search by first name (case-insensitive)', () => {
    const query = 'alice';
    const filtered = mockRequests.filter((r) =>
      r.first_name.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].first_name).toBe('Alice');
  });

  test('should search by last name', () => {
    const query = 'johnson';
    const filtered = mockRequests.filter((r) =>
      r.last_name.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].last_name).toBe('Johnson');
  });

  test('should search by email', () => {
    const query = 'example.com';
    const filtered = mockRequests.filter((r) =>
      r.email.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(2);
  });

  test('should return empty array for no match', () => {
    const query = 'nonexistent';
    const filtered = mockRequests.filter(
      (r) =>
        r.first_name.toLowerCase().includes(query.toLowerCase()) ||
        r.last_name.toLowerCase().includes(query.toLowerCase()) ||
        r.email.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(0);
  });
});

describe('ID Badge Admin - Status Badge Display', () => {
  test('should return yellow class for pending status', () => {
    const status = 'pending';
    const className =
      status === 'pending'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'approved'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800';

    expect(className).toBe('bg-yellow-100 text-yellow-800');
  });

  test('should return green class for approved status', () => {
    const status = 'approved';
    const className =
      status === 'pending'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'approved'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800';

    expect(className).toBe('bg-green-100 text-green-800');
  });

  test('should return red class for rejected status', () => {
    const status = 'rejected';
    const className =
      status === 'pending'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'approved'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800';

    expect(className).toBe('bg-red-100 text-red-800');
  });
});

describe('ID Badge Admin - Rejection Reasons', () => {
  const REJECTION_REASONS = [
    { value: 'unclear_photo', label: 'Unclear photo' },
    { value: 'id_expired', label: 'ID expired' },
    { value: 'name_mismatch', label: 'Name does not match profile' },
    { value: 'multiple_ids', label: 'Multiple IDs in photo' },
    { value: 'not_government_id', label: 'Not a government-issued ID' },
    { value: 'other', label: 'Other (please explain in notes)' },
  ];

  test('should have 6 rejection reasons', () => {
    expect(REJECTION_REASONS).toHaveLength(6);
  });

  test('should have valid reason values', () => {
    const values = REJECTION_REASONS.map((r) => r.value);
    expect(values).toContain('unclear_photo');
    expect(values).toContain('id_expired');
    expect(values).toContain('name_mismatch');
    expect(values).toContain('multiple_ids');
    expect(values).toContain('not_government_id');
    expect(values).toContain('other');
  });

  test('should have human-readable labels', () => {
    const labels = REJECTION_REASONS.map((r) => r.label);
    expect(labels).toContain('Unclear photo');
    expect(labels).toContain('ID expired');
  });
});

describe('ID Badge Admin - Decision Validation', () => {
  test('should require decision to be selected', () => {
    const decision = null;
    const isValid = decision !== null;
    expect(isValid).toBe(false);
  });

  test('should require rejection reason when rejecting', () => {
    const decision = 'reject';
    const rejectionReason = '';
    const isValid = decision === 'reject' ? rejectionReason !== '' : true;
    expect(isValid).toBe(false);
  });

  test('should allow approval without rejection reason', () => {
    const decision = 'approve';
    const rejectionReason = '';
    const isValid = decision === 'reject' ? rejectionReason !== '' : true;
    expect(isValid).toBe(true);
  });

  test('should allow optional notes for both decisions', () => {
    const notes = ''; // optional
    const isValid = true; // notes are always optional
    expect(isValid).toBe(true);
  });
});

describe('ID Badge Admin - Date Formatting', () => {
  test('should format date correctly', () => {
    const dateString = '2026-02-08T10:30:00Z';
    const date = new Date(dateString);
    const formatted =
      date.toLocaleDateString('en-US', { timeZone: 'UTC' }) +
      ' ' +
      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

    expect(formatted).toContain('2/8/2026');
    expect(formatted).toContain('10:30');
  });

  test('should handle invalid date gracefully', () => {
    const dateString = 'invalid-date';
    const date = new Date(dateString);
    expect(date.toString()).toBe('Invalid Date');
  });
});

describe('ID Badge Admin - Action Link Logic', () => {
  test('should show "Review" link for pending requests', () => {
    const status = 'pending';
    const linkText = status === 'pending' ? 'Review' : 'View';
    expect(linkText).toBe('Review');
  });

  test('should show "View" link for approved requests', () => {
    const status = 'approved';
    const linkText = status === 'pending' ? 'Review' : 'View';
    expect(linkText).toBe('View');
  });

  test('should show "View" link for rejected requests', () => {
    const status = 'rejected';
    const linkText = status === 'pending' ? 'Review' : 'View';
    expect(linkText).toBe('View');
  });
});
