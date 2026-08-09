// File: p2p-kids-admin/src/components/ui/MetricCard.tsx
import type { IconColorKey } from '@/styles/theme';
import { theme } from '@/styles/theme';

interface MetricCardProps {
  /** Label shown below icon in the card accent color */
  label:        string;
  /** The large primary number/value */
  value:        string | number;
  /** Supporting text below the value */
  subtitle?:    string;
  /** Icon element (Lucide icon or SVG) */
  icon:         React.ReactNode;
  /** Determines icon wrapper background and icon color */
  color:        IconColorKey;
  /** Optional: "+20%" → shown with green; "-2%" → shown with red */
  trend?:       string;
  trendDir?:    'up' | 'down' | 'neutral';
  className?:   string;
  testID?:      string;
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon,
  color,
  trend,
  trendDir = 'neutral',
  className = '',
  testID,
}: MetricCardProps) {
  const iconStyle = theme.iconColors[color];

  const trendColor =
    trendDir === 'up'   ? theme.colors.brand.green  :
    trendDir === 'down' ? 'var(--error-500)'        :
    theme.colors.text.muted;

  return (
    <div
      data-testid={testID}
      className={`rounded-2xl p-6 flex flex-col gap-3 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${className}`}
      style={{
        background: theme.colors.card.bg,
        border:     `1px solid ${theme.colors.card.border}`,
        boxShadow:  theme.shadow.card,
      }}
    >
      {/* Icon wrapper */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconStyle.bg, color: iconStyle.icon }}
      >
        {icon}
      </div>

      {/* Colored label */}
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: iconStyle.icon }}
      >
        {label}
      </span>

      {/* Large value */}
      <span
        className="text-3xl font-bold leading-none"
        style={{ color: theme.colors.text.primary }}
      >
        {value}
      </span>

      {/* Subtitle row */}
      <div className="flex items-center gap-2">
        {trend && (
          <span className="text-sm font-semibold" style={{ color: trendColor }}>
            {trend}
          </span>
        )}
        {subtitle && (
          <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
