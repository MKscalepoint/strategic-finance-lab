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
        // Scalepoint Partners brand — dark navy theme
        // Semantic tokens preserved so page.tsx class names stay valid
        ink:    "#ECFFE3",   // Primary text — SP mint on navy background
        paper:  "#222747",   // Page background — SP navy
        accent: "#A8F090",   // Highlight / CTA — vivid mint (brighter than ink for contrast)
        mist:   "#2E3460",   // Borders, dividers — mid navy
        slate:  "#8B93B8",   // Secondary text — muted blue-grey
        card:   "#1A1F3E",   // Card / input surfaces — deep navy
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
