'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function IDBadgeTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: 'Verification Queue', href: '/id-badges' },
    { name: 'Message Templates', href: '/id-badges/messages' },
  ];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
