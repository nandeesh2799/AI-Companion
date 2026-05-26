/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        companion: {
          pink: "#FF6EB4",
          blue: "#7EB8FF",
          yellow: "#FFE566",
        }
      },
      fontFamily: {
        rounded: ["Nunito", "M PLUS Rounded 1c", "sans-serif"],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
