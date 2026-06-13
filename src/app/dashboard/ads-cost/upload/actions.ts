"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AdsCostRowInput = {
  campaignName: string;
  amountSpent: number;
  productParentId: string;
  sourceId: string;
};

type SaveAdsCostUploadInput = {
  uploadDate: string;
  fileName?: string;
  rows: AdsCostRowInput[];
};

type ActionResult = {
  success: boolean;
  message: string;
};

function toMoney(value: unknown) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
}

export async function saveAdsCostUpload(
  payload: SaveAdsCostUploadInput
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "AGENT"].includes(session.user.role)) {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const uploadDate = String(payload.uploadDate || "").trim();
  const fileName = String(payload.fileName || "").trim() || null;

  if (!uploadDate) {
    return {
      success: false,
      message: "Upload date is required.",
    };
  }

  const rows = (payload.rows || [])
    .map((row) => ({
      campaignName: String(row.campaignName || "").trim(),
      amountSpent: toMoney(row.amountSpent),
      productParentId: String(row.productParentId || "").trim(),
      sourceId: String(row.sourceId || "").trim(),
    }))
    .filter(
      (row) =>
        row.campaignName &&
        row.amountSpent > 0 &&
        row.productParentId &&
        row.sourceId
    );

  if (!rows.length) {
    return {
      success: false,
      message: "Please add at least one valid ads cost row.",
    };
  }

  try {
    const totalAmount = rows.reduce(
      (sum, row) => sum + row.amountSpent,
      0
    );

    await prisma.adsCostUpload.create({
      data: {
        uploadDate: new Date(`${uploadDate}T00:00:00`),
        fileName,
        totalAmount,
        items: {
          create: rows.map((row) => ({
            campaignName: row.campaignName,
            amountSpent: row.amountSpent,
            productParentId: row.productParentId,
            sourceId: row.sourceId,
          })),
        },
      },
    });

    revalidatePath("/dashboard/ads-cost/upload");

    return {
      success: true,
      message: "Ads cost uploaded successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save ads cost upload.",
    };
  }
}

export async function deleteAdsCostUpload(
  uploadId: string
): Promise<ActionResult> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const id = String(uploadId || "").trim();

  if (!id) {
    return {
      success: false,
      message: "Upload ID is required.",
    };
  }

  try {
    await prisma.adsCostUpload.delete({
      where: {
        id,
      },
    });

    revalidatePath("/dashboard/ads-cost/upload");

    return {
      success: true,
      message: "Ads cost upload deleted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete ads cost upload.",
    };
  }
}