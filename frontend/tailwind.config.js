/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // <--- Add this line
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    require("@tailwindcss/forms"), // Optional: Better default form styles
  ],
};
