import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function prismaClientSingleton() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
  });

  const adapter = new PrismaMariaDb(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}