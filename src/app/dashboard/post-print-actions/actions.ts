"use server";

import { parse } from "csv-parse/sync";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";

type ActionState = { success: boolean; message: string };

async function requirePackagingAccess() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return session;
}

async function updateInvoices(
  invoiceIds: string[],
  orderStatus: "STOCK_OUT" | "CANCELLED",
  method: "SINGLE" | "CSV",
  userId: string
) {
  const { prisma } = await import("@/lib/prisma");

  const cleanIds = [...new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))];
  if (!cleanIds.length) return 0;

  const orders = await prisma.order.findMany({
    where: { invoiceId: { in: cleanIds } },
    select: {
      id: true,
      invoiceId: true,
      customerName: true,
      phone: true,
      orderStatus: true,
    },
  });

  if (!orders.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const order of orders) {
      await tx.order.update({
        where: { id: order.id },
        data: { orderStatus },
      });

      await tx.postPrintActionLog.create({
        data: {
          orderId: order.id,
          invoiceId: order.invoiceId,
          customerName: order.customerName,
          phone: order.phone,
          actionType: orderStatus,
          actionMethod: method,
          previousStatus: order.orderStatus,
          newStatus: orderStatus,
          performedByUserId: userId,
        },
      });
    }
  });

  return orders.length;
}

export async function markSingleInvoiceStockOut(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requirePackagingAccess();
    const invoiceId = String(formData.get("invoiceId") || "").trim();

    if (!invoiceId) return { success: false, message: "Invoice ID is required." };

    const count = await updateInvoices(
      [invoiceId],
      "STOCK_OUT",
      "SINGLE",
      session.user.id
    );

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: count ? `${count} order marked as stock out.` : "No matching invoice found.",
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
    const session = await requirePackagingAccess();
    const invoiceId = String(formData.get("invoiceId") || "").trim();

    if (!invoiceId) return { success: false, message: "Invoice ID is required." };

    const count = await updateInvoices(
      [invoiceId],
      "CANCELLED",
      "SINGLE",
      session.user.id
    );

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/ready-to-ship");

    return {
      success: true,
      message: count ? `${count} order marked as cancelled.` : "No matching invoice found.",
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

  // Support both CSVs with a header and simple one-column invoice lists.
  const first = String(rows[0]?.[0] || "").trim();
  const hasHeader = /invoice/i.test(first);
  const sourceRows = hasHeader ? rows.slice(1) : rows;

  return sourceRows
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean);
}

export async function bulkCsvStockOut(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requirePackagingAccess();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { success: false, message: "Please upload a CSV file." };
    }

    const count = await updateInvoices(
      extractInvoiceIdsFromCsv(await file.text()),
      "STOCK_OUT",
      "CSV",
      session.user.id
    );

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/stock-out");
    revalidatePath("/dashboard/ready-to-ship");

    return { success: true, message: `${count} orders marked as stock out from CSV.` };
  } catch {
    return { success: false, message: "Failed to process stock out CSV." };
  }
}

export async function bulkCsvCancelled(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requirePackagingAccess();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { success: false, message: "Please upload a CSV file." };
    }

    const count = await updateInvoices(
      extractInvoiceIdsFromCsv(await file.text()),
      "CANCELLED",
      "CSV",
      session.user.id
    );

    revalidatePath("/dashboard/post-print-actions");
    revalidatePath("/dashboard/cancelled");
    revalidatePath("/dashboard/ready-to-ship");

    return { success: true, message: `${count} orders marked as cancelled from CSV.` };
  } catch {
    return { success: false, message: "Failed to process cancel CSV." };
  }
}

export async function restoreStockOutOrder(orderId: string): Promise<ActionState> {
  try {
    await requirePackagingAccess();
    const { prisma } = await import("@/lib/prisma");

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

    return { success: true, message: "Order restored to ready to ship." };
  } catch {
    return { success: false, message: "Failed to restore stock out order." };
  }
}
