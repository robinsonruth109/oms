"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";

export type StockAdjustmentActionState = {
  success: boolean;
  message: string;
  warning?: boolean;
};

async function requireStockAdjustmentAccess() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return session;
}

function positiveInt(value: unknown) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function createProductStockAdjustment(
  _prevState: StockAdjustmentActionState,
  formData: FormData
): Promise<StockAdjustmentActionState> {
  try {
    const session = await requireStockAdjustmentAccess();

    const productId = String(formData.get("productId") || "").trim();
    const adjustmentDate = String(formData.get("adjustmentDate") || "").trim();
    const adjustmentType =
      String(formData.get("adjustmentType") || "").trim().toUpperCase() === "REDUCE"
        ? "REDUCE"
        : "ADD";
    const enteredQuantity = positiveInt(formData.get("quantity"));
    const reason = String(formData.get("reason") || "").trim();
    const note = String(formData.get("note") || "").trim();

    if (!productId) {
      return { success: false, message: "Select a valid product SKU." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentDate)) {
      return { success: false, message: "Select a valid adjustment date." };
    }

    if (!enteredQuantity) {
      return {
        success: false,
        message: "Adjustment quantity must be at least 1.",
      };
    }

    if (!reason) {
      return {
        success: false,
        message: "Reason is required for every stock adjustment.",
      };
    }

    const { prisma } = await import("@/lib/prisma");

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { parent: true },
      });

      if (!product) {
        throw new Error("Product SKU was not found.");
      }

      const parentStock = product.parent.stockMode === "PARENT_STOCK";
      const unitsPerSale = Math.max(1, Number(product.unitsPerSale || 1));
      const adjustedStockUnits = parentStock
        ? enteredQuantity * unitsPerSale
        : enteredQuantity;
      const unitCost = parentStock
        ? Number(product.parent.purchasePrice || 0)
        : Number(product.purchasePrice || 0);

      const stockBefore = parentStock
        ? Number(product.parent.stockQuantity || 0)
        : Number(product.quantity || 0);

      const delta =
        adjustmentType === "ADD" ? adjustedStockUnits : -adjustedStockUnits;
      const stockAfter = stockBefore + delta;
      const adjustmentValue = adjustedStockUnits * unitCost;

      if (parentStock) {
        await tx.productParent.update({
          where: { id: product.parentId },
          data: {
            stockQuantity:
              adjustmentType === "ADD"
                ? { increment: adjustedStockUnits }
                : { decrement: adjustedStockUnits },
          },
        });
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity:
              adjustmentType === "ADD"
                ? { increment: adjustedStockUnits }
                : { decrement: adjustedStockUnits },
          },
        });
      }

      await tx.productStockAdjustment.create({
        data: {
          adjustmentDate: bangladeshBusinessDateToUtc(adjustmentDate),
          adjustmentType,
          productId: product.id,
          parentId: product.parentId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          parentSkuSnapshot: product.parent.sku,
          stockOwnerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          stockOwnerId: parentStock ? product.parentId : product.id,
          enteredQuantity,
          unitsPerSale: parentStock ? unitsPerSale : 1,
          adjustedStockUnits,
          unitCost,
          adjustmentValue,
          stockBefore,
          stockAfter,
          reason,
          note: note || null,
          createdByUserId: session.user.id,
          createdByName:
            session.user.name || session.user.username || "OMS User",
        },
      });

      return {
        sku: product.sku,
        adjustedStockUnits,
        adjustmentValue,
        stockBefore,
        stockAfter,
      };
    });

    revalidatePath("/dashboard/stock-adjustments");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");
    revalidatePath("/dashboard/damage-products");

    const verb = adjustmentType === "ADD" ? "added to" : "removed from";

    return {
      success: true,
      warning: result.stockAfter < 0,
      message:
        `Stock adjustment saved for ${result.sku}. ${result.adjustedStockUnits} physical unit(s) ${verb} inventory. Value impact: BDT ${result.adjustmentValue.toFixed(2)}. Stock: ${result.stockBefore} → ${result.stockAfter}.` +
        (result.stockAfter < 0
          ? " Warning: stock is now negative."
          : ""),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to adjust stock.",
    };
  }
}
