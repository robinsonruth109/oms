"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

type ActionState = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  return Boolean(
    session &&
      session.user.role === "ADMIN"
  );
}

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function readRequired(
  formData: FormData,
  key: string
) {
  return String(
    formData.get(key) || ""
  ).trim();
}

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
  excludedCategoryId?: string
): Promise<string> {
  const prisma = await getPrisma();
  const baseSlug = createBaseSlug(name);

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const duplicate =
      await prisma.reelCategory.findFirst({
        where: {
          slug: candidate,
          ...(excludedCategoryId
            ? {
                NOT: {
                  id: excludedCategoryId,
                },
              }
            : {}),
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

function revalidateCategoryPaths(
  slug?: string | null
) {
  revalidatePath(
    "/dashboard/reel-categories"
  );

  revalidatePath("/reels");
  revalidatePath("/collections");

  if (slug) {
    revalidatePath(`/reels/${slug}`);
    revalidatePath(`/collections/${slug}`);
  }
}

export async function createReelCategory(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const name = readRequired(
    formData,
    "name"
  );

  const sourceId = readRequired(
    formData,
    "sourceId"
  );

  const pageId = readRequired(
    formData,
    "pageId"
  );

  const status =
    formData.get("status") === "true";

  const collectionVideoUrl = readRequired(
    formData,
    "collectionVideoUrl"
  );

  const collectionVideoPublicId = readRequired(
    formData,
    "collectionVideoPublicId"
  );

  if (!name || !sourceId || !pageId) {
    return {
      success: false,
      message:
        "Category name, source and page are required.",
    };
  }

  const prisma = await getPrisma();

  const [
    existingCategory,
    source,
    page,
  ] = await Promise.all([
    prisma.reelCategory.findFirst({
      where: {
        name,
      },
      select: {
        id: true,
      },
    }),

    prisma.orderSource.findUnique({
      where: {
        id: sourceId,
      },
      select: {
        id: true,
      },
    }),

    prisma.page.findUnique({
      where: {
        id: pageId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (existingCategory) {
    return {
      success: false,
      message:
        "Category name already exists.",
    };
  }

  if (!source || !page) {
    return {
      success: false,
      message:
        "Selected source or page was not found.",
    };
  }

  const slug = await createUniqueSlug(name);

  const category =
    await prisma.reelCategory.create({
      data: {
        name,
        slug,
        sourceId,
        pageId,
        collectionVideoUrl: collectionVideoUrl || null,
        collectionVideoPublicId: collectionVideoPublicId || null,
        status,
      },
      select: {
        slug: true,
      },
    });

  revalidateCategoryPaths(category.slug);

  return {
    success: true,
    message:
      "Reel category created successfully.",
  };
}

export async function updateReelCategory(
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = readRequired(formData, "id");

  const name = readRequired(
    formData,
    "name"
  );

  const sourceId = readRequired(
    formData,
    "sourceId"
  );

  const pageId = readRequired(
    formData,
    "pageId"
  );

  const status =
    formData.get("status") === "true";

  const collectionVideoUrl = readRequired(
    formData,
    "collectionVideoUrl"
  );

  const collectionVideoPublicId = readRequired(
    formData,
    "collectionVideoPublicId"
  );

  if (
    !id ||
    !name ||
    !sourceId ||
    !pageId
  ) {
    return {
      success: false,
      message:
        "All category fields are required.",
    };
  }

  const prisma = await getPrisma();

  const [
    category,
    duplicate,
    source,
    page,
  ] = await Promise.all([
    prisma.reelCategory.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        slug: true,
      },
    }),

    prisma.reelCategory.findFirst({
      where: {
        name,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    }),

    prisma.orderSource.findUnique({
      where: {
        id: sourceId,
      },
      select: {
        id: true,
      },
    }),

    prisma.page.findUnique({
      where: {
        id: pageId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!category) {
    return {
      success: false,
      message:
        "Reel category was not found.",
    };
  }

  if (duplicate) {
    return {
      success: false,
      message:
        "Category name already exists.",
    };
  }

  if (!source || !page) {
    return {
      success: false,
      message:
        "Selected source or page was not found.",
    };
  }

  const slug =
    category.slug ||
    (await createUniqueSlug(name, id));

  await prisma.reelCategory.update({
    where: {
      id,
    },
    data: {
      name,
      slug,
      sourceId,
      pageId,
      collectionVideoUrl: collectionVideoUrl || null,
      collectionVideoPublicId: collectionVideoPublicId || null,
      status,
    },
  });

  revalidateCategoryPaths(slug);

  return {
    success: true,
    message:
      "Reel category updated successfully.",
  };
}

export async function toggleReelCategory(
  id: string,
  status: boolean
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  if (!id.trim()) {
    return {
      success: false,
      message:
        "A reel category ID is required.",
    };
  }

  const prisma = await getPrisma();

  const category =
    await prisma.reelCategory.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        slug: true,
      },
    });

  if (!category) {
    return {
      success: false,
      message:
        "Reel category was not found.",
    };
  }

  await prisma.reelCategory.update({
    where: {
      id,
    },
    data: {
      status,
    },
  });

  revalidateCategoryPaths(category.slug);

  return {
    success: true,
    message: status
      ? "Category activated."
      : "Category deactivated.",
  };
}

export async function deleteReelCategory(
  id: string
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  if (!id.trim()) {
    return {
      success: false,
      message:
        "A reel category ID is required.",
    };
  }

  const prisma = await getPrisma();

  const category =
    await prisma.reelCategory.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        slug: true,
      },
    });

  if (!category) {
    return {
      success: false,
      message:
        "Reel category was not found.",
    };
  }

  try {
    await prisma.reelCategory.delete({
      where: {
        id,
      },
    });

    revalidateCategoryPaths(category.slug);

    return {
      success: true,
      message:
        "Reel category deleted successfully.",
    };
  } catch {
    return {
      success: false,
      message:
        "This category is already in use and cannot be deleted.",
    };
  }
}