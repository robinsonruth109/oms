import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const adminName = process.env.DEFAULT_ADMIN_NAME || "Default Admin";
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "StrongAdmin@123";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await prisma.user.findFirst({
    where: {
      username: adminUsername,
    },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: adminName,
        username: adminUsername,
        password: hashedPassword,
        role: "ADMIN",
        status: true,
      },
    });

    console.log("Default admin created.");
  } else {
    console.log("Default admin already exists.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });