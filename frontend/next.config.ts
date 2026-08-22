import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone = Docker/self-hosted; Vercel handles its own output
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
