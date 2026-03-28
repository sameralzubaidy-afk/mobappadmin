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
      boxShadow: {
        card: '0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04)',
        sidebar: '2px 0 8px rgba(61, 16, 115, 0.12)',
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
