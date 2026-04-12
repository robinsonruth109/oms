"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BatchActionState = {
  success: boolean;
  message: string;
  batchId?: string;
  downloadUrl?: string;
};

function makeBatchNo(prefix: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const i = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  return `${prefix}-${y}${m}${d}-${h}${i}${s}`;
}

function parseSelectedIds(raw: string) {
  try {
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => String(id)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function createInvoiceBatch(
  _prevState: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const selectedIds = parseSelectedIds(
    String(formData.get("selectedIds") || "[]")
  );
  const courier = String(formData.get("courier") || "").trim();

  if (!selectedIds.length) {
    return {
      success: false,
      message: "Please select at least one order.",
    };
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: selectedIds },
      orderStatus: "READY_TO_SHIP",
      invoiceDownloaded: false,
      ...(courier ? { courier } : {}),
    },
  });

  if (!orders.length) {
    return {
      success: false,
      message: "No valid non-invoiced ready-to-ship orders found.",
    };
  }

  const uniqueCouriers = [
    ...new Set(orders.map((order) => order.courier).filter(Boolean)),
  ];

  if (!uniqueCouriers.length) {
    return {
      success: false,
      message: "Selected orders are missing courier.",
    };
  }

  if (uniqueCouriers.length > 1) {
    return {
      success: false,
      message: "Selected orders must belong to the same courier.",
    };
  }

  const batchNo = makeBatchNo("INV");

  const batch = await prisma.$transaction(async (tx) => {
    const createdBatch = await tx.invoiceBatch.create({
      data: {
        batchNo,
        courier: uniqueCouriers[0],
        totalOrders: orders.length,
        createdByUserId: session.user.id,
      },
    });

    await tx.invoiceBatchItem.createMany({
      data: orders.map((order) => ({
        batchId: createdBatch.id,
        orderId: order.id,
      })),
    });

    await tx.order.updateMany({
      where: {
        id: {
          in: orders.map((order) => order.id),
        },
      },
      data: {
        invoiceDownloaded: true,
      },
    });

    return createdBatch;
  });

  revalidatePath("/dashboard/ready-to-ship");

  return {
    success: true,
    message: `Invoice batch created successfully: ${batch.batchNo}`,
    batchId: batch.id,
    downloadUrl: `/api/ready-to-ship/invoice-batch/${batch.id}`,
  };
}

export async function createCsvBatch(
  _prevState: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized action.",
    };
  }

  const selectedIds = parseSelectedIds(
    String(formData.get("selectedIds") || "[]")
  );
  const courier = String(formData.get("courier") || "").trim();

  if (!selectedIds.length) {
    return {
      success: false,
      message: "Please select at least one order.",
    };
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: selectedIds },
      orderStatus: "READY_TO_SHIP",
      csvDownloaded: false,
      ...(courier ? { courier } : {}),
    },
  });

  if (!orders.length) {
    return {
      success: false,
      message: "No valid non-CSV ready-to-ship orders found.",
    };
  }

  const uniqueCouriers = [
    ...new Set(orders.map((order) => order.courier).filter(Boolean)),
  ];

  if (!uniqueCouriers.length) {
    return {
      success: false,
      message: "Selected orders are missing courier.",
    };
  }

  if (uniqueCouriers.length > 1) {
    return {
      success: false,
      message: "Selected orders must belong to the same courier.",
    };
  }

  const batchNo = makeBatchNo("CSV");

  const batch = await prisma.$transaction(async (tx) => {
    const createdBatch = await tx.csvBatch.create({
      data: {
        batchNo,
        courier: uniqueCouriers[0],
        totalOrders: orders.length,
        createdByUserId: session.user.id,
      },
    });

    await tx.csvBatchItem.createMany({
      data: orders.map((order) => ({
        batchId: createdBatch.id,
        orderId: order.id,
      })),
    });

    await tx.order.updateMany({
      where: {
        id: {
          in: orders.map((order) => order.id),
        },
      },
      data: {
        csvDownloaded: true,
      },
    });

    return createdBatch;
  });

  revalidatePath("/dashboard/ready-to-ship");

  return {
    success: true,
    message: `CSV batch created successfully: ${batch.batchNo}`,
    batchId: batch.id,
    downloadUrl: `/api/ready-to-ship/csv-batch/${batch.id}`,
  };
}