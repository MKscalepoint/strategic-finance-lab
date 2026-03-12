import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scalepoint Partners brand palette
        ink:    "#222747",   // SP navy — primary text, buttons, strong UI
        paper:  "#222747",   // Same navy — full dark background
        accent: "#ECFFE3",   // SP mint — highlights, active states, CTAs
        mist:   "#2E3460",   // Mid navy — borders, dividers, subtle surfaces
        slate:  "#8B93B8",   // Muted blue-grey — secondary text
        card:   "#1C2040",   // Deeper navy — card backgrounds
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        mono:    ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
        sans:    ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-up":  "fadeUp 0.5s ease forwards",
        "fade-in":  "fadeIn 0.3s ease forwards",
        "cursor":   "cursor 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        cursor: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
