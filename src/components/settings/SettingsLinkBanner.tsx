// filepath: p2p-kids-admin/src/components/settings/SettingsLinkBanner.tsx
//
// Cross-link banner used to connect the /config hub with the standalone
// settings pages so admins never edit a setting in one place and silently
// diverge from the other.
//
// Implements the design-system Banner Card (Info variant):
//   - Background: Info 100  #E1F5FE
//   - Border:     1px solid Info 500 #29B6F6
//   - Radius:     12px (rounded-xl), Padding: 16px
//   - Icon:       24px, Info 500 (#29B6F6), left
//   - Message:    Body text, Neutral 900 (#1A1A1A)
//   - CTA:        Link text, Secondary 500 (#5B8FB9), underline
// (Tokens per docx/old/design-system.md §2.4 / §6.2)

import React from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';

interface SettingsLinkBannerProps {
  /** Main message, e.g. "Related settings also live in Config → Tax" */
  message: string;
  /** Destination of the cross-link. */
  href: string;
  /** Link label, e.g. "Open Tax Settings". */
  linkLabel: string;
  /** Stable test id for manual/automated verification. */
  testId?: string;
}

export default function SettingsLinkBanner({
  message,
  href,
  linkLabel,
  testId,
}: SettingsLinkBannerProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4 text-sm"
      style={{
        backgroundColor: '#E1F5FE',
        border: '1px solid #29B6F6',
      }}
      role="note"
      data-testid={testId ?? 'settings-link-banner'}
    >
      <Info
        size={24}
        style={{ color: '#29B6F6' }}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1">
        <p style={{ color: '#1A1A1A' }}>{message}</p>
        <Link
          href={href}
          className="inline-block mt-1 font-medium underline"
          style={{ color: '#5B8FB9' }}
          data-testid={testId ? `${testId}-link` : 'settings-link-banner-link'}
        >
          {linkLabel} →
        </Link>
      </div>
    </div>
  );
}
