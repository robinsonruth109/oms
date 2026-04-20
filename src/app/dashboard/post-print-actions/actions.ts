"use server";

import { parse } from "csv-parse/sync";
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

async function updateInvoices(
  invoiceIds: string[],
  orderStatus: "STOCK_OUT" | "CANCELLED"
) {
  const cleanIds = [...new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))];

  if (!cleanIds.length) {
    return 0;
  }

  const result = await prisma.order.updateMany({
    where: {
      invoiceId: {
        in: cleanIds,
      },
    },
    data: {
      orderStatus,
    },
  });

  return result.count;
}

export async function markSingleInvoiceStockOut(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const invoiceId = String(formData.get("invoiceId") || "").trim();

    if (!invoiceId) {
      return { success: false, message: "Invoice ID is required." };
    }

    const count = await updateInvoices([invoiceId], "STOCK_OUT");

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: count
        ? `${count} order marked as stock out.`
        : "No matching invoice found.",
    };
  } catch {
    return { success: false, message: "Failed to update stock out." };
  }
}

export async function markSingleInvoiceCancelled(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const invoiceId = String(formData.get("invoiceId") || "").trim();

    if (!invoiceId) {
      return { success: false, message: "Invoice ID is required." };
    }

    const count = await updateInvoices([invoiceId], "CANCELLED");

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: count
        ? `${count} order marked as cancelled.`
        : "No matching invoice found.",
    };
  } catch {
    return { success: false, message: "Failed to update cancelled status." };
  }
}

function extractInvoiceIdsFromCsv(content: string) {
  const rows = parse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];

  if (!rows.length) return [];

  return rows
    .slice(1)
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean);
}

export async function bulkCsvStockOut(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { success: false, message: "Please upload a CSV file." };
    }

    const content = await file.text();
    const invoiceIds = extractInvoiceIdsFromCsv(content);
    const count = await updateInvoices(invoiceIds, "STOCK_OUT");

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: `${count} orders marked as stock out from CSV.`,
    };
  } catch {
    return { success: false, message: "Failed to process stock out CSV." };
  }
}

export async function bulkCsvCancelled(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { success: false, message: "Please upload a CSV file." };
    }

    const content = await file.text();
    const invoiceIds = extractInvoiceIdsFromCsv(content);
    const count = await updateInvoices(invoiceIds, "CANCELLED");

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: `${count} orders marked as cancelled from CSV.`,
    };
  } catch {
    return { success: false, message: "Failed to process cancel CSV." };
  }
}

export async function restoreStockOutOrder(orderId: string): Promise<ActionState> {
  try {
    await requireAdmin();

    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: "READY_TO_SHIP",
        invoiceDownloaded: false,
        csvDownloaded: false,
        readyToShipAt: new Date(),
      },
    });

    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/ready-to-ship");
    revalidatePath("/dashboard/post-print-actions");

    return {
      success: true,
      message: "Order restored to ready to ship.",
    };
  } catch {
    return {
      success: false,
      message: "Failed to restore stock out order.",
    };
  }
}