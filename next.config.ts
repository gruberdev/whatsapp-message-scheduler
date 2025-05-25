import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark problematic packages as external for server-side
      config.externals = config.externals || [];
      config.externals.push({
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
        'puppeteer': 'commonjs puppeteer',
        'sharp': 'commonjs sharp',
      });
    }

    // Ignore problematic modules that cause issues
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      child_process: false,
    };

    // Handle specific module resolution issues
    config.resolve.alias = {
      ...config.resolve.alias,
      './lib-cov/fluent-ffmpeg': false,
      'fluent-ffmpeg': false,
    };

    // Ignore specific modules that cause build issues
    config.plugins = config.plugins || [];
    config.plugins.push(
      new config.webpack.IgnorePlugin({
        resourceRegExp: /^(fluent-ffmpeg|@ffmpeg-installer\/ffmpeg)$/,
      })
    );

    return config;
  },
  
  // Updated configuration for Next.js 15+
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'fluent-ffmpeg'],
};

export default nextConfig;
