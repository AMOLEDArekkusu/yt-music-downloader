import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API requests to Flask backend during local development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
