// File: p2p-kids-admin/src/lib/formatAgo.ts
//
// FIX-Task-23 items 7 + 8: ONE relative-age formatter for the admin portal's
// freshness affordances. Extracted from the /reviews queue header (FIX-Task-21
// item 8) so the auth gate can report staleness the same way instead of inventing
// a second format.

/**
 * Coarse relative age. Deliberately low-resolution — these labels are a confidence
 * signal about when data was last read, not a live timer.
 */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
