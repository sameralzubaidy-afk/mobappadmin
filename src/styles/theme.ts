// File: p2p-kids-admin/src/styles/theme.ts
// Single source of truth for design tokens (docx/old/design-system.md).
// Use Tailwind classes where possible; use these when inline styles are needed.

export const theme = {
  colors: {
    sidebar: {
      bg:     '#FFFFFF',                 // White (light sidebar)
      active: '#4A7C59',                 // Primary 500
      text:   '#FFFFFF',
      muted:  '#808080',                 // Neutral 500
    },
    brand: {
      primary: '#4A7C59', // Primary 500
      accent:  '#FF8C42', // Accent 500
      green:   '#4CAF50', // Success 500
      blue:    '#5B8FB9', // Secondary 500
    },
    content: {
      bg: '#FAFAFA', // Neutral 50
    },
    card: {
      bg:     '#FFFFFF',
      border: '#CCCCCC', // Neutral 300
    },
    text: {
      primary:   '#1A1A1A', // Neutral 900
      secondary: '#4D4D4D', // Neutral 700
      muted:     '#808080', // Neutral 500
    },
    topbar: {
      bg:     '#FFFFFF',
      border: '#CCCCCC', // Neutral 300
    },
    neutral: {
      '100': '#F5F5F5',
      '500': '#808080',
      '700': '#4D4D4D',
    },
  },

  spacing: {
    sidebarWidth:  '256px',
    topbarHeight:  '64px',
    cardPadding:   '16px', // design-system §4.2 card padding (md)
    sectionGap:    '24px', // lg
  },

  shadow: {
    card:    '0px 2px 8px rgba(0, 0, 0, 0.08)', // Level 1 (§8.1)
    sidebar: '2px 0 8px rgba(0, 0, 0, 0.12)',
    level2:  '0px 4px 16px rgba(0, 0, 0, 0.12)',
  },

  /** Metric card icon colors — maps to icon wrapper bg (design-system §2) */
  iconColors: {
    purple: { bg: '#E8F3EC', icon: '#4A7C59' }, // Primary 100 / Primary 500
    orange: { bg: '#FFF4ED', icon: '#FF8C42' }, // Accent 100 / Accent 500
    green:  { bg: '#E8F5E9', icon: '#4CAF50' }, // Success 100 / Success 500
    blue:   { bg: '#EBF4F9', icon: '#5B8FB9' }, // Secondary 100 / Secondary 500
  },

  /** Subscription tier badge colors (design-system §2.4 + §2.5) */
  subscriptionColors: {
    trial:        { bg: '#FFF8E1', text: '#F59E0B' }, // SP gold
    active:       { bg: '#E8F5E9', text: '#4CAF50' }, // Success
    grace_period: { bg: '#FFF3E0', text: '#FFA726' }, // Warning 100 / 500
    cancelled:    { bg: '#FFEBEE', text: '#E53935' }, // Error 100 / 500
    none:         { bg: '#F5F5F5', text: '#808080' }, // Neutral 100 / 500
  },

  /** Account status colors (design-system §2.4) */
  accountStatusColors: {
    active:    { bg: '#E8F5E9', text: '#4CAF50' }, // Success
    suspended: { bg: '#FFF3E0', text: '#FFA726' }, // Warning
    banned:    { bg: '#FFEBEE', text: '#E53935' }, // Error
  },
} as const;

export type ThemeColor = typeof theme.colors;
export type IconColorKey = keyof typeof theme.iconColors;
export type SubscriptionStatus = keyof typeof theme.subscriptionColors;
export type AccountStatus = keyof typeof theme.accountStatusColors;
