// File: p2p-kids-admin/src/app/action-center/page.tsx
// Admin Action Center — single feed of every pending admin action.
// Thin server wrapper; all logic lives in ActionCenterClient (client component).

import ActionCenterClient from './ActionCenterClient';

export const dynamic = 'force-dynamic';

export default function ActionCenterPage() {
  return <ActionCenterClient />;
}
