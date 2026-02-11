import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#191919",      // Midnight
        secondary: "#4A3427",    // Porsche
        accent: "#886752",       // Whiskey
        light: "#E1DDD1",        // Moontower
        denim: "#93B9BC",        // Faded Denim
        zilker: "#324A32",       // Zilker
      },
      fontFamily: {
        sans: [
          "Neue Haas Grotesk Display Pro",
          "NHaasGroteskDSPro-65Md",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
