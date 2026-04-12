import { prisma } from "./prisma";

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
    },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        name: "Default Admin",
        username: "admin",
        password: "admin123", // later we will hash
        role: "ADMIN",
      },
    });

    console.log("✅ Default admin created:", admin);
  } else {
    console.log("ℹ️ Admin already exists. Skipping...");
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  