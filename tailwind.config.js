/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#F3BA2F',
          dark: '#C99400',
        },
        accent: {
          DEFAULT: '#0ECB81',
          dark: '#059669',
        },
        dark: {
          DEFAULT: '#0B0E11',
          lighter: '#1E2329',
          lightest: '#2B3139',
        },
        error: {
          DEFAULT: '#F6465D',
        }
      },
      opacity: {
        '2': '0.02',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      }
    },
  },
  plugins: [],
}
