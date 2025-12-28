'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function TradeFilters({ 
  initialStatus, 
  initialSearch 
}: { 
  initialStatus: string, 
  initialSearch: string 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`/trades?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get('search') as string;
    
    const params = new URLSearchParams(searchParams.toString());
    if (!search) {
      params.delete('search');
    } else {
      params.set('search', search);
    }
    router.push(`/trades?${params.toString()}`);
  };

  return (
    <div className="bg-white p-4 rounded shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select 
          name="status" 
          defaultValue={initialStatus}
          className="border border-gray-300 rounded px-3 py-2"
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="payment_processing">Payment Processing</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="payment_failed">Payment Failed</option>
        </select>
      </div>

      <div className="flex-grow">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search Trades</label>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            name="search" 
            defaultValue={initialSearch}
            placeholder="Search by ID, Name, Email, or Phone..."
            className="border border-gray-300 rounded px-3 py-2 flex-grow"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
