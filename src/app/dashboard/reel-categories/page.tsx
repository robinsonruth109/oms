import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import ReelCategoryManager from "./reel-category-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReelCategoriesPage() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");

  const [categories, sources, pages] = await Promise.all([
    prisma.reelCategory.findMany({
      include: {
        source: {
          select: {
            id: true,
            name: true,
          },
        },
        page: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.orderSource.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.page.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <ReelCategoryManager
      categories={categories.map((category) => ({
        ...category,
        createdAt: category.createdAt.toISOString(),
      }))}
      sources={sources}
      pages={pages}
    />
  );
}