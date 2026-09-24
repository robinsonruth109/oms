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

  webpack(config, { isServer }) {
    if (isServer) {
      // The instrumentation bundle is compiled separately by Next.js.
      // serverExternalPackages alone is not always enough there, so keep
      // Prisma's MariaDB driver outside the webpack bundle and let Node load it.
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];

      config.externals = [
        ...externals,
        "@prisma/adapter-mariadb",
        "mariadb",
      ];
    }

    return config;
  },
};

export default nextConfig;