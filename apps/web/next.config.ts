import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/tempapp",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
