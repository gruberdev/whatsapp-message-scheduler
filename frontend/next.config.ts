import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Simple configuration for frontend-only app
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://whatsapp-message-scheduler-production-be31.up.railway.app',
  },
};

export default nextConfig;
