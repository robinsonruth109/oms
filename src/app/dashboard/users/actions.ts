"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

type CreateUserState = {
  success: boolean;
  message: string;
};

export type DeleteUserResult = {
  success: boolean;
  message: string;
};

const ALLOWED_ROLES: Role[] = [
  "ADMIN",
  "AGENT",
  "NOTE_AGENT",
  "PACKAGING_AGENT",
];

function isRole(value: string): value is Role {
  return ALLOWED_ROLES.includes(value as Role);
}

async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return session;
}

export async function createUser(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await requireAdminSession();

  if (!session) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const roleValue = String(formData.get("role") || "").trim();

  if (!name || !username || !password || !roleValue) {
    return {
      success: false,
      message: "All fields are required.",
    };
  }

  if (!isRole(roleValue)) {
    return {
      success: false,
      message: "Invalid role selected.",
    };
  }

  const { prisma } = await import("@/lib/prisma");

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    return {
      success: false,
      message: "Username already exists.",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      username,
      password: hashedPassword,
      role: roleValue,
      status: true,
    },
  });

  revalidatePath("/dashboard/users");

  return {
    success: true,
    message: "User created successfully.",
  };
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const session = await requireAdminSession();

  if (!session) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = String(userId || "").trim();

  if (!id) {
    return {
      success: false,
      message: "User id is required.",
    };
  }

  if (id === session.user.id) {
    return {
      success: false,
      message: "You cannot delete your own logged-in admin account.",
    };
  }

  const { prisma } = await import("@/lib/prisma");

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      _count: {
        select: {
          invoiceBatches: true,
          csvBatches: true,
        },
      },
    },
  });

  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: {
        role: "ADMIN",
      },
    });

    if (adminCount <= 1) {
      return {
        success: false,
        message: "The last admin account cannot be deleted.",
      };
    }
  }

  if (user._count.invoiceBatches > 0 || user._count.csvBatches > 0) {
    return {
      success: false,
      message:
        "This user has invoice/CSV batch history and cannot be permanently deleted. Deactivate the account instead if needed.",
    };
  }

  try {
    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `${user.name} deleted successfully.`,
    };
  } catch (error) {
    console.error("Failed to delete user:", error);

    return {
      success: false,
      message:
        "This user is still referenced by protected OMS records and cannot be deleted safely.",
    };
  }
}
