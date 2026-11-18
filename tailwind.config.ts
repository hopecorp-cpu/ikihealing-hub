import type { Config } from "tailwindcss";

const thang = (tien: string) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((b) => [b, `rgb(var(--${tien}${b}) / <alpha-value>)`]));

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: thang("g"),
        slate: thang("s"),
        brand: {
          50: "#ECFDF5", 100: "#D1FAE5", 200: "#A7F3D0", 300: "#6EE7B7", 400: "#34D399",
          500: "#10B981", 600: "#059669", 700: "#047857", 800: "#065F46", 900: "#064E3B"
        },
        vang: { DEFAULT: "#D7B46A", sang: "#E8CC8C" },
      }
    }
  },
  plugins: []
};
export default config;
