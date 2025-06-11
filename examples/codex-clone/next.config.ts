import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Temporal Worker from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@temporalio/worker': false,
        '@swc/core': false,
        '@swc/core-darwin-arm64': false,
        '@swc/core-linux-x64-gnu': false,
        '@swc/core-linux-x64-musl': false,
        '@swc/core-win32-x64-msvc': false,
      };
    }
    return config;
  },
};

export default nextConfig;
