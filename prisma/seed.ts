import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: "localhost",
  user: "root",
  password: "Sabbir44477&&",
  database: "oms_db",
  connectionLimit: 5,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const existingAdmin = await prisma.user.findUnique({
    where: {
      username: "admin",
    },
  });

  if (existingAdmin) {
    console.log("⚠️ Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      name: "Default Admin",
      username: "admin",
      password: hashedPassword,
      role: "ADMIN",
      status: true,
    },
  });

  console.log("✅ Admin user created");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });