import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#137c8b",
        "brand-d": "#0f606b",
        gold: "#a89723",
        ink: "#1a1d1e",
        muted: "#6b7173",
        line: "#eceeef",
        soft: "#f6f7f7",
      },
      fontFamily: {
        sans: ["var(--ui-font)", "Poppins", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
