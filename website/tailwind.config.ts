import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#6366F1",
          violet: "#7C3AED",
          blue: "#3B82F6",
          yellow: "#FBBF24",
          teal: "#14B8A6",
        },
      },
      boxShadow: {
        card: "0 18px 50px rgba(99, 102, 241, 0.12)",
        soft: "0 8px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
