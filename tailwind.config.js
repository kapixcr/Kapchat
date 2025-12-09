/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kap': {
          'dark': 'var(--color-bg-dark)',
          'darker': 'var(--color-bg-darker)',
          'surface': 'var(--color-surface)',
          'surface-light': 'var(--color-surface-light)',
          'border': 'var(--color-border)',
          'accent': 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          'accent-soft': 'rgba(var(--color-accent-rgb), 0.15)',
          'success': 'var(--color-success)',
          'warning': 'var(--color-warning)',
          'danger': 'var(--color-danger)',
          'whatsapp': 'var(--color-whatsapp)',
          'email': 'var(--color-email)',
        }
      },
      fontFamily: {
        'display': ['Outfit', 'sans-serif'],
        'body': ['DM Sans', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(var(--color-accent-rgb), 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(var(--color-accent-rgb), 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
