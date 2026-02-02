// Admin Referral Analytics Dashboard
// filepath: p2p-kids-admin/src/app/referrals/page.tsx

import { AdminReferralAnalyticsService } from '@/lib/adminReferralAnalytics';

export default async function ReferralAnalyticsPage() {
  try {
    const [metrics, topReferrers, funnel] = await Promise.all([
      AdminReferralAnalyticsService.getMetrics(),
      AdminReferralAnalyticsService.getTopReferrers(10),
      AdminReferralAnalyticsService.getFunnel(),
    ]);

    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Referral Program Analytics</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="K-Factor"
            value={metrics.k_factor.toString()}
            subtitle="Avg referrals per user"
            variant={metrics.k_factor > 1 ? 'success' : 'warning'}
          />
          <MetricCard
            title="Total Referrals"
            value={metrics.total_referrals.toString()}
            subtitle={`${metrics.completed_referrals} completed`}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${metrics.signup_to_trade_rate}%`}
            subtitle="Signup → first trade"
          />
          <MetricCard
            title="SP Distributed"
            value={metrics.total_sp_distributed.toString()}
            subtitle="Via referral bonuses"
          />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Conversion Funnel</h2>
          <div className="space-y-3">
            <FunnelStep
              label="Signups"
              value={funnel.signups}
              rate={100}
              isFirst
            />
            <FunnelStep
              label="First Trades"
              value={funnel.first_trades}
              rate={funnel.trade_rate}
            />
            <FunnelStep
              label="Rewards Granted"
              value={funnel.rewards_granted}
              rate={funnel.reward_rate}
            />
          </div>
        </div>

        {/* Top Referrers Leaderboard */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top Referrers</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Rank</th>
                  <th className="text-left py-2 px-4">Email</th>
                  <th className="text-right py-2 px-4">Total Referrals</th>
                  <th className="text-right py-2 px-4">Completed</th>
                  <th className="text-right py-2 px-4">SP Earned</th>
                  <th className="text-right py-2 px-4">Trial Extensions</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((referrer, index) => (
                  <tr key={referrer.user_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-600">#{index + 1}</span>
                    </td>
                    <td className="py-3 px-4">{referrer.email}</td>
                    <td className="py-3 px-4 text-right">{referrer.total_referrals}</td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {referrer.completed_referrals}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600">
                      {referrer.total_sp_earned} SP
                    </td>
                    <td className="py-3 px-4 text-right">
                      {referrer.trial_extensions_earned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topReferrers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No referral data yet
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Analytics</h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  variant = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning';
}) {
  const bgColors = {
    default: 'bg-white',
    success: 'bg-green-50',
    warning: 'bg-yellow-50',
  };

  const textColors = {
    default: 'text-gray-900',
    success: 'text-green-700',
    warning: 'text-yellow-700',
  };

  return (
    <div className={`${bgColors[variant]} rounded-lg shadow p-6`}>
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${textColors[variant]} mb-1`}>{value}</p>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

// Funnel Step Component
function FunnelStep({
  label,
  value,
  rate,
  isFirst = false,
}: {
  label: string;
  value: number;
  rate: number;
  isFirst?: boolean;
}) {
  const width = rate;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-600">
          {value} <span className="text-blue-600">({rate}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-6">
        <div
          className={`h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs font-semibold ${
            isFirst ? 'bg-blue-600' : rate > 50 ? 'bg-green-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${width}%` }}
        >
          {!isFirst && width > 20 && `${rate}%`}
        </div>
      </div>
    </div>
  );
}
