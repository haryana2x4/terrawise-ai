/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agro: {
          green: "#1b4332",
          light: "#e8f5e9",
          mid: "#2d6a4f",
          accent: "#52b788",
          gold: "#d4a373",
          warm: "#fefae0"
        }
      },
      fontSize: {
        // Enforcing Rule R5: body text 18px or larger
        'base': ['1.125rem', { lineHeight: '1.65rem' }], // 18px
        'lg': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        'xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '2xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
      }
    },
  },
  plugins: [],
}
