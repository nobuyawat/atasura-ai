import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          500: '#2563EB',
          600: '#1D4ED8',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',
        },
      },
    },
  },
  plugins: [],
}
export default config
