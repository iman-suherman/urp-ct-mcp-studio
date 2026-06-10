import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // suherman.net dev stack opens http://127.0.0.1:3000 while Next binds localhost by default.
  allowedDevOrigins: ["127.0.0.1:3000", "127.0.0.1"],
  // Standalone output is for Cloud Run deploy only; avoid mixing prod build artifacts into `next dev`.
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
