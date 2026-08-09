/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        sidebar: {
          bg:     '#FFFFFF', // White (light sidebar)
          active: '#4A7C59', // Primary 500
          text:   '#FFFFFF',
          muted:  '#808080', // Neutral 500
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
        // Design-system token scale (docx/old/design-system.md §2) — used across
        // all admin pages so colors are traceable to the spec instead of arbitrary
        // Tailwind palette colors.
        primary: {
          50:  '#F0F7F2',
          100: '#E8F3EC',
          300: '#CFE4D6',
          400: '#6B9B7A',
          500: '#4A7C59',
          600: '#3A5F47',
          700: '#2F4C38',
          800: '#263D2E',
        },
        accent: {
          100: '#FFF4ED',
          400: '#FFB380',
          500: '#FF8C42',
          600: '#E67A2E',
          700: '#C2621F',
        },
        secondary: {
          100: '#EBF4F9',
          400: '#7BA9CC',
          500: '#5B8FB9',
          600: '#4A7699',
          700: '#3B5F7A',
        },
        success: {
          50:  '#F2FBF3',
          100: '#E8F5E9',
          500: '#4CAF50',
          600: '#3D9140',
          900: '#1B5E20',
        },
        warning: {
          50:  '#FFF8EF',
          100: '#FFF3E0',
          500: '#FFA726',
          600: '#FB8C00',
          900: '#E65100',
        },
        error: {
          50:  '#FFEFEF',
          100: '#FFEBEE',
          500: '#E53935',
          600: '#C62828',
          900: '#B71C1C',
        },
        info: {
          100: '#E1F5FE',
          500: '#29B6F6',
          700: '#0288D1',
        },
        sp: {
          100: '#FEF3C7',
          500: '#F59E0B',
        },
        neutral: {
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#CCCCCC',
          500: '#808080',
          700: '#4D4D4D',
          900: '#1A1A1A',
        },
      },
      boxShadow: {
        card:    '0px 2px 8px rgba(0, 0, 0, 0.08)', // Level 1 (§8.1)
        sidebar: '2px 0 8px rgba(0, 0, 0, 0.12)',
      },
      width: {
        sidebar: '256px',
      },
      height: {
        topbar: '64px',
      },
    },
  },
  plugins: [],
}
