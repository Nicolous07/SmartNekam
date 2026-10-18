import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next.js/Turbopack scoped to this app instead of a parent folder lockfile.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
