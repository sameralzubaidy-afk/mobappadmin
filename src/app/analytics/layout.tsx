'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  icon: string;
}

const ANALYTICS_TABS: Tab[] = [
  { label: 'Revenue', href: '/analytics', icon: '💰' },
  { label: 'Notifications', href: '/analytics/notifications', icon: '🔔' },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Analytics Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200">
          {ANALYTICS_TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {children}
    </div>
  );
}
