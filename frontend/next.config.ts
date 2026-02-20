import type { NextConfig } from "next";

// BACKEND_API_URL is a server-side-only env var (no NEXT_PUBLIC_ prefix).
// It is read here at server.js startup — NOT baked into the client bundle.
// The browser always calls the relative path /backend/* which Next.js rewrites
// to this URL at the proxy layer. This makes it truly runtime-configurable
// via the Helm ConfigMap with no rebuild needed.
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:5001";

const nextConfig: NextConfig = {
  // Produces a minimal standalone build — needed for multi-stage Docker image.
  output: "standalone",

  async rewrites() {
    return [
      {
        // All calls to /backend/* are transparently proxied to the real backend.
        // The browser never needs to know the backend's cluster DNS name.
        source: "/backend/:path*",
        destination: `${BACKEND_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
