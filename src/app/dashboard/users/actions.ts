"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateUserState = {
  success: boolean;
  message: string;
};

export async function createUser(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "").trim();

  if (!name || !username || !password || !role) {
    return {
      success: false,
      message: "All fields are required.",
    };
  }

  if (role !== "ADMIN" && role !== "AGENT") {
    return {
      success: false,
      message: "Invalid role selected.",
    };
  }

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
      role,
      status: true,
    },
  });

  revalidatePath("/dashboard/users");

  return {
    success: true,
    message: "User created successfully.",
  };
}