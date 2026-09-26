"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";
import { resolvePhysicalRequirements } from "@/lib/inventory";

export type StockAdjustmentActionState = {
  success: boolean;
  message: string;
  warning?: boolean;
};

export async function createProductStockAdjustment(
  _prevState: StockAdjustmentActionState,
  formData: FormData
): Promise<StockAdjustmentActionState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      throw new Error("Unauthorized");
    }

    const productId = String(formData.get("productId") || "").trim();
    const adjustmentDate = String(formData.get("adjustmentDate") || "").trim();
    const type = String(formData.get("adjustmentType") || "").trim().toUpperCase();
    const qty = Number(formData.get("quantity"));
    const reason = String(formData.get("reason") || "").trim();
    const note = String(formData.get("note") || "").trim();

    if (!productId) return { success: false, message: "Select a valid SKU." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentDate)) {
      return { success: false, message: "Select a valid adjustment date." };
    }
    if (!["ADD", "REDUCE"].includes(type)) {
      return { success: false, message: "Choose Add Stock or Reduce Stock." };
    }
    if (!Number.isSafeInteger(qty) || qty < 1) {
      return { success: false, message: "Quantity must be a positive whole number." };
    }
    if (!reason) return { success: false, message: "Reason is required." };

    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId }, include: { parent: true },
      });
      if (!product) throw new Error("Product SKU not found.");

      const requirements = await resolvePhysicalRequirements(tx, product, qty);
      const isBundle = product.inventoryKind === "BUNDLE";
      const breakdown: Array<{
        ownerSku: string; ownerType: string; units: number;
        unitCost: number; before: number; after: number;
      }> = [];

      for (const owner of requirements) {
        const before = owner.available;
        let after: number;
        if (owner.ownerType === "PRODUCT_PARENT") {
          const updated = await tx.productParent.update({
            where: { id: owner.ownerId },
            data: {
              stockQuantity: type === "ADD"
                ? { increment: owner.requiredUnits }
                : { decrement: owner.requiredUnits },
            },
            select: { stockQuantity: true },
          });
          after = updated.stockQuantity;
        } else {
          const updated = await tx.product.update({
            where: { id: owner.ownerId },
            data: {
              quantity: type === "ADD"
                ? { increment: owner.requiredUnits }
                : { decrement: owner.requiredUnits },
            },
            select: { quantity: true },
          });
          after = updated.quantity;
        }
        breakdown.push({
          ownerSku: owner.ownerLabel,
          ownerType: owner.ownerType,
          units: owner.requiredUnits,
          unitCost: owner.unitCost,
          before, after,
        });
      }

      const units = breakdown.reduce((sum, row) => sum + row.units, 0);
      const value = Math.round(
        breakdown.reduce((sum, row) => sum + row.units * row.unitCost, 0) * 100
      ) / 100;
      const first = breakdown[0];

      await tx.productStockAdjustment.create({
        data: {
          adjustmentDate: bangladeshBusinessDateToUtc(adjustmentDate),
          adjustmentType: type as "ADD" | "REDUCE",
          productId: product.id,
          parentId: product.parentId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          parentSkuSnapshot: product.parent.sku,
          stockOwnerType: isBundle ? "PRODUCT" : first.ownerType,
          stockOwnerId: isBundle ? product.id : requirements[0].ownerId,
          enteredQuantity: qty,
          unitsPerSale: units / qty,
          adjustedStockUnits: units,
          unitCost: units ? Math.round(value / units * 100) / 100 : 0,
          adjustmentValue: value,
          stockBefore: isBundle ? 0 : first.before,
          stockAfter: isBundle ? 0 : first.after,
          componentBreakdown: isBundle ? JSON.stringify(breakdown) : null,
          reason, note: note || null,
          createdByUserId: session.user.id,
          createdByName: session.user.name || session.user.username || "OMS User",
        },
      });

      return { sku: product.sku, units, value, breakdown };
    });

    revalidatePath("/dashboard/stock-adjustments");
    revalidatePath("/dashboard/damage-products");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");
    const verb = type === "ADD" ? "added to" : "removed from";
    return {
      success: true,
      warning: result.breakdown.some((row) => row.after < 0),
      message: "Adjustment saved for " + result.sku + ": " +
        result.units + " physical units " + verb + " inventory, value BDT " +
        result.value.toFixed(2) + ". " +
        result.breakdown.map((row) =>
          row.ownerSku + " " + row.before + " → " + row.after
        ).join("; ") + ".",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to adjust stock.",
    };
  }
}
