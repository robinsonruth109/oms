import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function prismaClientSingleton() {
  const adapter = new PrismaMariaDb({
    host: "localhost",
    user: "root",
    password: "Sabbir44477&&",
    database: "oms_db",
    connectionLimit: 5,
  });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}