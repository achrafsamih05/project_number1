import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d9d9df",
          300: "#b7b7c1",
          400: "#8d8d9b",
          500: "#6b6b7a",
          600: "#51515d",
          700: "#3f3f49",
          800: "#26262d",
          900: "#151519",
          950: "#0a0a0d",
        },
        brand: {
          50: "#f1f7ff",
          100: "#e0edff",
          200: "#bcd9ff",
          300: "#8ebcff",
          400: "#5f97ff",
          500: "#3b74ff",
          600: "#2656ee",
          700: "#1e43c4",
          800: "#1d389d",
          900: "#1b337c",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20, 20, 30, 0.04), 0 8px 24px rgba(20, 20, 30, 0.06)",
        lift: "0 4px 16px rgba(20, 20, 30, 0.08), 0 24px 48px rgba(20, 20, 30, 0.10)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-in-right": "slide-in-right 220ms ease-out",
        "slide-in-left": "slide-in-left 220ms ease-out",
        pop: "pop 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
