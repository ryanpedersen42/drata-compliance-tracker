import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components (PPR) is aimed at static/marketing pages that benefit
  // from partial prerendering. This app is an internal, fully dynamic,
  // DB-backed dashboard, so it's left off to avoid Suspense-boundary
  // ceremony around ordinary database reads.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
