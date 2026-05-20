import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // USC Brand
        cardinal: {
          DEFAULT: "#990000",
          50: "#fff1f1",
          100: "#ffdede",
          200: "#ffc2c2",
          300: "#ff9696",
          400: "#fb5959",
          500: "#ef2a2a",
          600: "#cc1414",
          700: "#a80f0f",
          800: "#990000",
          900: "#7a0a0a",
          950: "#430303",
        },
        gold: {
          DEFAULT: "#FFCC00",
          50: "#fffbe6",
          100: "#fff4b8",
          200: "#ffe97a",
          300: "#ffd93d",
          400: "#ffcc00",
          500: "#e6b400",
          600: "#b88a00",
          700: "#946a05",
          800: "#7a560c",
          900: "#684810",
        },
        ink: {
          DEFAULT: "#0E0E10",
          soft: "#1c1c20",
          muted: "#3a3a40",
        },
        canvas: {
          DEFAULT: "#fafaf7",
          soft: "#f3f1ea",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', '"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,15,15,.06), 0 8px 24px -12px rgba(15,15,15,.18)",
        ring: "0 0 0 3px rgba(153,0,0,.18)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
