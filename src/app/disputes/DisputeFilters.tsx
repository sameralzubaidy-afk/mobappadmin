'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type DisputeStatusFilter = 'all' | 'reported' | 'under_review';

export default function DisputeFilters({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabs: { label: string; value: DisputeStatusFilter }[] = [
    { label: 'All Disputed', value: 'all' },
    { label: 'Reported', value: 'reported' },
    { label: 'Under Review', value: 'under_review' },
  ];

  const handleTabClick = (value: DisputeStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    router.push(`/disputes?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 mb-6">
      {tabs.map((tab) => {
        const isActive = initialStatus === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleTabClick(tab.value)}
            data-testid={`disputes-tab-${tab.value}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-amber-500 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
