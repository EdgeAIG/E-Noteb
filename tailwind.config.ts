import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        card: "var(--card)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        warm: "var(--warm)",
        sage: "var(--sage)",
        clay: "var(--clay)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        lift: "0 1px 0 rgba(255,255,255,.65) inset, 0 10px 30px -18px rgba(40,28,12,.28)",
        soft: "0 8px 24px -16px rgba(40,28,12,.22)",
      },
      borderRadius: {
        xl2: "1.15rem",
      },
    },
  },
  plugins: [],
};

export default config;
