import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function createBaseSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "reel-category";
}

async function createUniqueSlug(
  name: string,
  categoryId: string
): Promise<string> {
  const baseSlug = createBaseSlug(name);

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const duplicate =
      await prisma.reelCategory.findFirst({
        where: {
          slug: candidate,
          NOT: {
            id: categoryId,
          },
        },
        select: {
          id: true,
        },
      });

    if (!duplicate) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function main() {
  const categories =
    await prisma.reelCategory.findMany({
      where: {
        OR: [
          {
            slug: null,
          },
          {
            slug: "",
          },
        ],
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  if (!categories.length) {
    console.log(
      "All reel categories already have public slugs."
    );

    return;
  }

  console.log(
    `Found ${categories.length} reel categor${
      categories.length === 1 ? "y" : "ies"
    } without a slug.`
  );

  for (const category of categories) {
    const slug = await createUniqueSlug(
      category.name,
      category.id
    );

    await prisma.reelCategory.update({
      where: {
        id: category.id,
      },
      data: {
        slug,
      },
    });

    console.log(
      `Updated "${category.name}" → /reels/${slug}`
    );
  }

  console.log(
    "Reel category slug backfill completed."
  );
}

main()
  .catch((error) => {
    console.error(
      "Reel category slug backfill failed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });