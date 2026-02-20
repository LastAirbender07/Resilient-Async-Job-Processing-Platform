import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal standalone build — needed for multi-stage Docker image.
  // The .next/standalone folder contains everything needed to run `node server.js`.
  output: "standalone",
};

export default nextConfig;
