import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function buildMariaDbConfig() {
  const rawUrl = process.env.DATABASE_URL?.trim();

  if (!rawUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const url = new URL(rawUrl);

  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error(
      "DATABASE_URL must use mysql:// or mariadb:// for the MariaDB Prisma adapter."
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL is missing the database host or database name.");
  }

  return {
    host: url.hostname,
    port: positiveInt(url.port, 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,

    // Prisma ORM v7's MariaDB adapter defaults to a 1 second connection
    // timeout. That is too aggressive for a laptop connecting to a remote
    // Railway database and caused pool timeouts while the dashboard launched
    // many queries in parallel.
    connectionLimit: positiveInt(process.env.DB_CONNECTION_LIMIT, 10),
    connectTimeout: positiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
    acquireTimeout: positiveInt(process.env.DB_ACQUIRE_TIMEOUT_MS, 30_000),

    // MariaDB's idleTimeout is expressed in seconds.
    idleTimeout: positiveInt(process.env.DB_IDLE_TIMEOUT_SECONDS, 300),
  };
}

function prismaClientSingleton() {
  const adapter = new PrismaMariaDb(buildMariaDbConfig());

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
