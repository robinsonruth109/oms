"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateSourceState = {
  success: boolean;
  message: string;
};

export async function createSource(
  _prevState: CreateSourceState,
  formData: FormData
): Promise<CreateSourceState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "").trim();

  if (!name || !type) {
    return {
      success: false,
      message: "Source name and type are required.",
    };
  }

  if (!["SHOPIFY", "LARAVEL", "MANUAL"].includes(type)) {
    return {
      success: false,
      message: "Invalid source type.",
    };
  }

  const existingSource = await prisma.orderSource.findUnique({
    where: {
      name,
    },
  });

  if (existingSource) {
    return {
      success: false,
      message: "Source already exists.",
    };
  }

  await prisma.orderSource.create({
    data: {
      name,
      type: type as "SHOPIFY" | "LARAVEL" | "MANUAL",
      status: true,
    },
  });

  revalidatePath("/dashboard/sources");

  return {
    success: true,
    message: "Source created successfully.",
  };
}