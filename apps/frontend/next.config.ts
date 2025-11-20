import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared package in development
  // Next.js will use the source files via the "source" export condition
  transpilePackages: ['@workspace/shared', '@workspace/ui', '@workspace/database'],

  experimental: {
    // Use the optimized package imports feature
    optimizePackageImports: ['@workspace/shared'],
  },

  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  },

  // Webpack configuration (fallback for when using --webpack flag)
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution for .js extensions in TypeScript files
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    return config;
  },
};

export default nextConfig;
