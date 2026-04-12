"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCourier(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const slugInput = String(formData.get("slug") || "").trim();
    const slug = normalizeSlug(slugInput || name);

    if (!name || !slug) {
      return {
        success: false,
        message: "Courier name is required.",
      };
    }

    const existing = await prisma.courier.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existing) {
      return {
        success: false,
        message: "Courier name or slug already exists.",
      };
    }

    await prisma.courier.create({
      data: {
        name,
        slug,
        status: true,
      },
    });

    revalidatePath("/dashboard/couriers");

    return {
      success: true,
      message: "Courier created successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to create courier.",
    };
  }
}

export async function toggleCourierStatus(
  courierId: string,
  nextStatus: boolean
): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.courier.update({
      where: {
        id: courierId,
      },
      data: {
        status: nextStatus,
      },
    });

    revalidatePath("/dashboard/couriers");

    return {
      success: true,
      message: "Courier status updated.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to update courier status.",
    };
  }
}