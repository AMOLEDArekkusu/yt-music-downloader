import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN devices (e.g. phone, tablet) to receive HMR updates during dev
  allowedDevOrigins: ["192.168.0.209"],

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
