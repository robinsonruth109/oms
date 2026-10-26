"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
  return parsed;
}

function monthDate(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("Invalid month");
  const parsed = new Date(value + "-01T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid month");
  return parsed;
}

function nonNegativeInt(value: number, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(label + " must be 0 or more");
  }
  return parsed;
}

function money(value: number, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(label + " is invalid");
  return Math.round(parsed * 100) / 100;
}

function refresh() {
  revalidatePath("/dashboard/merchant-past-history");
  revalidatePath("/dashboard/merchant-control");
  revalidatePath("/dashboard/merchant/profit-loss");
}

export async function saveMerchantOmsStartDate(input: {
  merchantId: string;
  startDate: string;
}) {
  try {
    await requireAdmin();
    if (!input.merchantId) throw new Error("Select a Merchant");

    const startDate = dateOnly(input.startDate);
    await prisma.merchant.update({
      where: { id: input.merchantId },
      data: { omsAccountingStartDate: startDate },
    });

    refresh();
    return {
      success: true,
      message:
        "OMS accounting border date saved. Manual history remains before this date; live OMS accounting starts from this date.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save border date",
    };
  }
}

export async function saveMerchantPastHistory(input: {
  merchantId: string;
  parentId: string;
  historyMonth: string;
  courierSendQty: number;
  returnReceivedQty: number;
  adsCostBdt: number;
  returnCost: number;
  discount: number;
  profit: number;
  note?: string;
}) {
  try {
    await requireAdmin();

    if (!input.merchantId) throw new Error("Select a Merchant");
    if (!input.parentId) throw new Error("Select a Parent SKU");

    const historyMonth = monthDate(input.historyMonth);
    const merchant = await prisma.merchant.findUnique({
      where: { id: input.merchantId },
      select: { id: true, omsAccountingStartDate: true },
    });
    if (!merchant) throw new Error("Merchant not found");
    if (!merchant.omsAccountingStartDate) {
      throw new Error("Set this Merchant's OMS accounting start date first");
    }
    if (historyMonth >= merchant.omsAccountingStartDate) {
      throw new Error(
        "This month is not past history. Choose a month before the Merchant's OMS start date."
      );
    }

    const parent = await prisma.productParent.findUnique({
      where: { id: input.parentId },
      select: { id: true, merchantId: true },
    });
    if (!parent) throw new Error("Parent SKU not found");

    const allocation = await prisma.merchantStockAllocation.findFirst({
      where: { merchantId: input.merchantId, parentId: input.parentId },
      select: { id: true },
    });

    if (!allocation && parent.merchantId !== input.merchantId) {
      throw new Error("This Parent SKU is not assigned to the selected Merchant");
    }

    await prisma.merchantPastHistory.upsert({
      where: {
        merchantId_parentId_historyMonth: {
          merchantId: input.merchantId,
          parentId: input.parentId,
          historyMonth,
        },
      },
      update: {
        courierSendQty: nonNegativeInt(input.courierSendQty, "Courier Send"),
        returnReceivedQty: nonNegativeInt(
          input.returnReceivedQty,
          "Return Received"
        ),
        adsCostBdt: money(input.adsCostBdt, "Ads Cost"),
        returnCost: money(input.returnCost, "Return Cost"),
        discount: money(input.discount, "Discount"),
        profit: money(input.profit, "Profit"),
        note: input.note?.trim() || null,
      },
      create: {
        merchantId: input.merchantId,
        parentId: input.parentId,
        historyMonth,
        courierSendQty: nonNegativeInt(input.courierSendQty, "Courier Send"),
        returnReceivedQty: nonNegativeInt(
          input.returnReceivedQty,
          "Return Received"
        ),
        adsCostBdt: money(input.adsCostBdt, "Ads Cost"),
        returnCost: money(input.returnCost, "Return Cost"),
        discount: money(input.discount, "Discount"),
        profit: money(input.profit, "Profit"),
        note: input.note?.trim() || null,
      },
    });

    refresh();
    return {
      success: true,
      message: "Past history saved for this Merchant, Parent SKU and month.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save past history",
    };
  }
}

export async function deleteMerchantPastHistory(id: string) {
  try {
    await requireAdmin();
    if (!id) throw new Error("History row is required");
    await prisma.merchantPastHistory.delete({ where: { id } });
    refresh();
    return { success: true, message: "Past history row deleted." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to delete history",
    };
  }
}
