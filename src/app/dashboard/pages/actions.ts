"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreatePageState = {
  success: boolean;
  message: string;
};

export async function createPage(
  _prevState: CreatePageState,
  formData: FormData
): Promise<CreatePageState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const name = String(formData.get("name") || "").trim();
  const prefixCode = String(formData.get("prefixCode") || "")
    .trim()
    .toUpperCase();

  if (!name || !prefixCode) {
    return {
      success: false,
      message: "Page name and prefix code are required.",
    };
  }

  const existingPage = await prisma.page.findFirst({
    where: {
      OR: [{ name }, { prefixCode }],
    },
  });

  if (existingPage) {
    return {
      success: false,
      message: "Page name or prefix code already exists.",
    };
  }

  await prisma.page.create({
    data: {
      name,
      prefixCode,
      status: true,
    },
  });

  revalidatePath("/dashboard/pages");

  return {
    success: true,
    message: "Page created successfully.",
  };
}