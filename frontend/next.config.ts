import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Simple configuration for frontend-only app
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
