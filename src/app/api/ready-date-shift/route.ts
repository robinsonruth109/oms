import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  bangladeshBusinessDateToUtc,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";

const MAX_SHIFT_ORDERS = 2000;
const MAX_CSV_INVOICES = 2000;

function normalizeIds(values: unknown[]) {
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
}

function isValidBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    const parsed = bangladeshBusinessDateToUtc(value);
    return !Number.isNaN(parsed.getTime());
  } catch {
    return false;
  }
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER", "PACKAGING_AGENT"].includes(session.user.role)) {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const { prisma } = await import("@/lib/prisma");

  try {
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "LOOKUP") {
      const normalized = normalizeIds(Array.isArray(body?.invoiceIds) ? body.invoiceIds : []);

      if (!normalized.length) {
        return NextResponse.json({
          success: false,
          message: "No invoice IDs were found in column A.",
          orders: [],
          missingInvoiceIds: [],
          ineligible: [],
        });
      }

      if (normalized.length > MAX_CSV_INVOICES) {
        return NextResponse.json({
          success: false,
          message: `A maximum of ${MAX_CSV_INVOICES} invoice IDs can be checked in one upload.`,
          orders: [],
          missingInvoiceIds: [],
          ineligible: [],
        });
      }

      const rows = await prisma.order.findMany({
        where: { invoiceId: { in: normalized } },
        select: {
          id: true,
          invoiceId: true,
          customerName: true,
          phone: true,
          courier: true,
          totalAmount: true,
          orderStatus: true,
          readyToShipAt: true,
        },
      });

      const foundByInvoice = new Map(
        rows.filter((row) => row.invoiceId).map((row) => [String(row.invoiceId), row])
      );

      const missingInvoiceIds = normalized.filter((invoiceId) => !foundByInvoice.has(invoiceId));
      const ineligible = rows
        .filter((row) => row.orderStatus !== "READY_TO_SHIP")
        .map((row) => ({
          invoiceId: row.invoiceId || "N/A",
          reason: `Order status is ${row.orderStatus}`,
        }));

      const orders = rows
        .filter((row) => row.orderStatus === "READY_TO_SHIP")
        .sort((a, b) => {
          const aIndex = a.invoiceId ? normalized.indexOf(a.invoiceId) : 999999;
          const bIndex = b.invoiceId ? normalized.indexOf(b.invoiceId) : 999999;
          return aIndex - bIndex;
        })
        .map((row) => ({
          id: row.id,
          invoiceId: row.invoiceId,
          customerName: row.customerName,
          phone: row.phone,
          courier: row.courier,
          totalAmount: Number(row.totalAmount),
          readyToShipDate: getBangladeshDateInputValue(row.readyToShipAt),
        }));

      return NextResponse.json({
        success: true,
        message: `${orders.length} eligible Ready to Ship order(s) found. Printed/downloaded invoices are allowed.`,
        orders,
        missingInvoiceIds,
        ineligible,
      });
    }

    if (action === "SHIFT") {
      const selectedIds = normalizeIds(Array.isArray(body?.orderIds) ? body.orderIds : []);
      const targetDate = String(body?.targetDate || "").trim();
      const method = String(body?.method || "");
      const uploadedFileName = String(body?.uploadedFileName || "").trim();

      if (!selectedIds.length) {
        return NextResponse.json({ success: false, message: "Please select at least one order.", shiftedCount: 0, skippedSameDate: 0 });
      }
      if (selectedIds.length > MAX_SHIFT_ORDERS) {
        return NextResponse.json({ success: false, message: `A maximum of ${MAX_SHIFT_ORDERS} orders can be shifted in one action.`, shiftedCount: 0, skippedSameDate: 0 });
      }
      if (!isValidBusinessDate(targetDate)) {
        return NextResponse.json({ success: false, message: "Please choose a valid Ready to Ship target date.", shiftedCount: 0, skippedSameDate: 0 });
      }
      if (!["DATE_FILTER", "CSV_UPLOAD"].includes(method)) {
        return NextResponse.json({ success: false, message: "Invalid shift method.", shiftedCount: 0, skippedSameDate: 0 });
      }

      const targetReadyToShipAt = bangladeshBusinessDateToUtc(targetDate);

      const result = await prisma.$transaction(async (tx) => {
        const orders = await tx.order.findMany({
          where: { id: { in: selectedIds }, orderStatus: "READY_TO_SHIP" },
          select: { id: true, invoiceId: true, invoiceDownloaded: true, readyToShipAt: true },
        });

        if (orders.length !== selectedIds.length) {
          throw new Error("Shift blocked. One or more selected orders are no longer READY_TO_SHIP. Refresh the page and try again.");
        }

        const shiftableOrders = orders.filter(
          (order) => getBangladeshDateInputValue(order.readyToShipAt) !== targetDate
        );
        const skippedSameDate = orders.length - shiftableOrders.length;

        if (!shiftableOrders.length) {
          throw new Error("All selected orders are already on the selected target date.");
        }

        const sourceDates = [...new Set(shiftableOrders.map((order) => getBangladeshDateInputValue(order.readyToShipAt)))];

        const shift = await tx.readyToShipDateShift.create({
          data: {
            sourceDate: sourceDates.length === 1 ? sourceDates[0] : null,
            targetDate,
            method,
            totalOrders: shiftableOrders.length,
            uploadedFileName: method === "CSV_UPLOAD" && uploadedFileName ? uploadedFileName.slice(0, 191) : null,
            performedByUserId: session.user.id,
          },
        });

        await tx.readyToShipDateShiftItem.createMany({
          data: shiftableOrders.map((order) => ({
            shiftId: shift.id,
            orderId: order.id,
            invoiceIdSnapshot: order.invoiceId,
            fromReadyToShipAt: order.readyToShipAt,
            toReadyToShipAt: targetReadyToShipAt,
          })),
        });

        const updateResult = await tx.order.updateMany({
          where: { id: { in: shiftableOrders.map((order) => order.id) }, orderStatus: "READY_TO_SHIP" },
          data: { readyToShipAt: targetReadyToShipAt },
        });

        if (updateResult.count !== shiftableOrders.length) {
          throw new Error("Shift blocked because one or more orders changed while the operation was running. Refresh the page and try again.");
        }

        await tx.orderAuditEvent.createMany({
          data: shiftableOrders.map((order) => ({
            orderId: order.id,
            eventType: "READY_TO_SHIP_DATE_SHIFT",
            title: "Ready to Ship date changed",
            performedByUserId: session.user.id,
            actorLabel: session.user.name || session.user.username || "OMS User",
            details: {
              shiftId: shift.id,
              method,
              fromDate: getBangladeshDateInputValue(order.readyToShipAt),
              toDate: targetDate,
              invoiceDownloaded: order.invoiceDownloaded,
            },
          })),
        });

        return { shiftId: shift.id, shiftedCount: shiftableOrders.length, skippedSameDate, sourceDates };
      });

      const sourceLabel = result.sourceDates.length === 1 ? result.sourceDates[0] : `${result.sourceDates.length} source dates`;

      return NextResponse.json({
        success: true,
        message: `${result.shiftedCount} order(s) shifted from ${sourceLabel} to ${targetDate}.${result.skippedSameDate ? ` ${result.skippedSameDate} order(s) were already on the target date and were skipped.` : ""}`,
        shiftedCount: result.shiftedCount,
        skippedSameDate: result.skippedSameDate,
        shiftId: result.shiftId,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Ready Date Shift request failed.",
        orders: [],
        missingInvoiceIds: [],
        ineligible: [],
        shiftedCount: 0,
        skippedSameDate: 0,
      },
      { status: 500 }
    );
  }
}
