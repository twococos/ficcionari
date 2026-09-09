/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de Ficcionari (vegeu .claude/PLA-DESENVOLUPAMENT.md)
        primary: {
          DEFAULT: '#0058F8', // Primary & background
          dark: '#001048', // Primary Dark
        },
        accent: '#F8C800', // Accent
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
}
