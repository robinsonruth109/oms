import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  output: "standalone",

  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "firebase-admin",
    "mariadb",
  ],
};

export default nextConfig;