// File: p2p-kids-admin/src/styles/theme.ts
// Single source of truth for design tokens.
// Use Tailwind classes where possible; use these when inline styles are needed.

export const theme = {
  colors: {
    sidebar: {
      bg:     '#3D1073',
      active: '#5A2D9C',
      text:   '#FFFFFF',
      muted:  '#C4A8E8',
    },
    brand: {
      primary: '#6C3CE1',
      accent:  '#FF6B35',
      green:   '#28A745',
      blue:    '#17A2B8',
    },
    content: {
      bg: '#F2F0FB',
    },
    card: {
      bg:     '#FFFFFF',
      border: '#F0EDF9',
    },
    text: {
      primary:   '#2D2D4E',
      secondary: '#6B6B8F',
      muted:     '#9B97B5',
    },
    topbar: {
      bg:     '#FFFFFF',
      border: '#F0EDF9',
    },
  },

  spacing: {
    sidebarWidth:  '256px',
    topbarHeight:  '64px',
    cardPadding:   '24px',
    sectionGap:    '24px',
  },

  shadow: {
    card:    '0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04)',
    sidebar: '2px 0 8px rgba(61, 16, 115, 0.12)',
  },

  /** Metric card icon colors — maps to icon wrapper bg */
  iconColors: {
    purple: { bg: '#EDE7F6', icon: '#6C3CE1' },
    orange: { bg: '#FFF3EC', icon: '#FF6B35' },
    green:  { bg: '#E8F5E9', icon: '#28A745' },
    blue:   { bg: '#E3F2FD', icon: '#17A2B8' },
  },

  /** Subscription tier badge colors */
  subscriptionColors: {
    trial:        { bg: '#FFF8E1', text: '#F59E0B' },
    active:       { bg: '#E8F5E9', text: '#28A745' },
    grace_period: { bg: '#FFF3EC', text: '#FF6B35' },
    cancelled:    { bg: '#FEEBEE', text: '#E53935' },
    none:         { bg: '#F0EDF9', text: '#9B97B5' },
  },

  /** Account status colors */
  accountStatusColors: {
    active:    { bg: '#E8F5E9', text: '#28A745' },
    suspended: { bg: '#FFF3EC', text: '#FF6B35' },
    banned:    { bg: '#FEEBEE', text: '#E53935' },
  },
} as const;

export type ThemeColor = typeof theme.colors;
export type IconColorKey = keyof typeof theme.iconColors;
export type SubscriptionStatus = keyof typeof theme.subscriptionColors;
export type AccountStatus = keyof typeof theme.accountStatusColors;
