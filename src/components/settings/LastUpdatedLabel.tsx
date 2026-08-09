// filepath: p2p-kids-admin/src/components/settings/LastUpdatedLabel.tsx
//
// "Last updated" metadata label rendered on every setting field.
//
// Design-system Label style (docx/old/design-system.md §2.3 / §3.2):
//   12px, 500 Medium, uppercase, letter-spacing 0.5px, Neutral 700 (#4D4D4D).
//
// Source of truth is admin_config.updated_at + updated_by (resolved to email)
// so the value is identical whether the edit came from the /config hub or a
// standalone settings page.

import React from 'react';

interface LastUpdatedLabelProps {
  /** ISO timestamp of the last edit (admin_config.updated_at). */
  updatedAt?: string | null;
  /** Editor display (resolved email or fallback id). */
  editor?: string | null;
  /** Stable test id for manual/automated verification. */
  testId?: string;
}

export default function LastUpdatedLabel({
  updatedAt,
  editor,
  testId = 'last-updated',
}: LastUpdatedLabelProps) {
  if (!updatedAt) return null;

  const when = new Date(updatedAt).toLocaleString();
  return (
    <p
      className="text-[12px] font-medium uppercase"
      style={{ color: '#4D4D4D', letterSpacing: '0.5px' }}
      data-testid={testId}
    >
      Last updated · {when}
      {editor ? ` · by ${editor}` : ''}
    </p>
  );
}
