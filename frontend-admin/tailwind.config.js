/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0b0f17",
          panel: "#111827",
          soft: "#1f2937",
          violet: "#7c3aed",
        },
      },
      boxShadow: {
        panel: "0 10px 40px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        panel: "28px",
      },
    },
  },
  plugins: [],
};