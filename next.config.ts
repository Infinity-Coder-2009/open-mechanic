import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      resolveAlias: {
        "@/*": "./*",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack(config: any) {
      config.externals.push({
        "utf-8-validate": "commonjs utf-8-validate",
        "bufferutil": "commonjs bufferutil",
      });
      return config;
    },
};

export default nextConfig;