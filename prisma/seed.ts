import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log("Admin already exists. Skipping...");
    return;
  }

  const plainPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.user.create({
    data: {
      name: process.env.DEFAULT_ADMIN_NAME || "Default Admin",
      username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
      password: hashedPassword,
      role: Role.ADMIN,
      status: true,
    },
  });

  console.log("Default admin created:", admin.username);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });