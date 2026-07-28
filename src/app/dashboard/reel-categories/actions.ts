"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

type ActionState = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);

  return Boolean(session && session.user.role === "ADMIN");
}

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function readRequired(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
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

  const name = readRequired(formData, "name");
  const sourceId = readRequired(formData, "sourceId");
  const pageId = readRequired(formData, "pageId");
  const status = formData.get("status") === "true";

  if (!name || !sourceId || !pageId) {
    return {
      success: false,
      message: "Category name, source and page are required.",
    };
  }

  const prisma = await getPrisma();

  const [existingCategory, source, page] = await Promise.all([
    prisma.reelCategory.findFirst({
      where: {
        name,
      },
    }),
    prisma.orderSource.findUnique({
      where: {
        id: sourceId,
      },
    }),
    prisma.page.findUnique({
      where: {
        id: pageId,
      },
    }),
  ]);

  if (existingCategory) {
    return {
      success: false,
      message: "Category name already exists.",
    };
  }

  if (!source || !page) {
    return {
      success: false,
      message: "Selected source or page was not found.",
    };
  }

  await prisma.reelCategory.create({
    data: {
      name,
      sourceId,
      pageId,
      status,
    },
  });

  revalidatePath("/dashboard/reel-categories");

  return {
    success: true,
    message: "Reel category created successfully.",
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
  const name = readRequired(formData, "name");
  const sourceId = readRequired(formData, "sourceId");
  const pageId = readRequired(formData, "pageId");
  const status = formData.get("status") === "true";

  if (!id || !name || !sourceId || !pageId) {
    return {
      success: false,
      message: "All category fields are required.",
    };
  }

  const prisma = await getPrisma();

  const [category, duplicate, source, page] = await Promise.all([
    prisma.reelCategory.findUnique({
      where: {
        id,
      },
    }),
    prisma.reelCategory.findFirst({
      where: {
        name,
        NOT: {
          id,
        },
      },
    }),
    prisma.orderSource.findUnique({
      where: {
        id: sourceId,
      },
    }),
    prisma.page.findUnique({
      where: {
        id: pageId,
      },
    }),
  ]);

  if (!category) {
    return {
      success: false,
      message: "Reel category was not found.",
    };
  }

  if (duplicate) {
    return {
      success: false,
      message: "Category name already exists.",
    };
  }

  if (!source || !page) {
    return {
      success: false,
      message: "Selected source or page was not found.",
    };
  }

  await prisma.reelCategory.update({
    where: {
      id,
    },
    data: {
      name,
      sourceId,
      pageId,
      status,
    },
  });

  revalidatePath("/dashboard/reel-categories");

  return {
    success: true,
    message: "Reel category updated successfully.",
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

  const prisma = await getPrisma();

  const category = await prisma.reelCategory.findUnique({
    where: {
      id,
    },
  });

  if (!category) {
    return {
      success: false,
      message: "Reel category was not found.",
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

  revalidatePath("/dashboard/reel-categories");

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

  const prisma = await getPrisma();

  const category = await prisma.reelCategory.findUnique({
    where: {
      id,
    },
  });

  if (!category) {
    return {
      success: false,
      message: "Reel category was not found.",
    };
  }

  try {
    await prisma.reelCategory.delete({
      where: {
        id,
      },
    });

    revalidatePath("/dashboard/reel-categories");

    return {
      success: true,
      message: "Reel category deleted successfully.",
    };
  } catch {
    return {
      success: false,
      message: "This category is already in use and cannot be deleted.",
    };
  }
}