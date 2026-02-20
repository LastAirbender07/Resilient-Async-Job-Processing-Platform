import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal standalone build — needed for multi-stage Docker image.
  // The .next/standalone folder contains everything needed to run `node server.js`.
  output: "standalone",

  // NOTE: Do NOT use async rewrites() for the backend URL.
  // next.config.ts is evaluated at `next build` — process.env read here is
  // baked into the bundle. The runtime Helm ConfigMap value would be ignored.
  // Use the catch-all proxy at /api/backend/[...path] instead.
};

export default nextConfig;
