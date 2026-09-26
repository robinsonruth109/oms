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
    const rawQty = String(formData.get("quantity") ?? "").trim();
    const qty = Number(rawQty);
    const reason = String(formData.get("reason") || "").trim();
    const note = String(formData.get("note") || "").trim();

    if (!productId) return { success: false, message: "Select a valid SKU." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentDate)) {
      return { success: false, message: "Select a valid adjustment date." };
    }
    if (!["ADD", "REDUCE", "SET_COUNT"].includes(type)) {
      return { success: false, message: "Choose Add, Reduce, or Set Physical Count." };
    }
    if (!rawQty || !Number.isSafeInteger(qty) ||
      (type === "SET_COUNT" ? qty < 0 : qty < 1)) {
      return {
        success: false,
        message: type === "SET_COUNT"
          ? "Enter the actual physical count (zero or greater)."
          : "Adjustment quantity must be a positive whole number.",
      };
    }
    if (!reason) return { success: false, message: "Reason is required." };

    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId }, include: { parent: true },
      });
      if (!product) throw new Error("Product SKU not found.");

      if (type === "SET_COUNT") {
        // Exact physical counts must never be applied to a virtual bundle.
        // For a parent-stock product, enter the number of physical PARENT units,
        // not the number of sets sold by this child SKU.
        if (product.inventoryKind !== "PHYSICAL") {
          throw new Error(
            "A virtual bundle has no physical count. Count its real component SKUs individually."
          );
        }

        const shared = product.parent.stockMode === "PARENT_STOCK";
        const before = shared ? product.parent.stockQuantity : product.quantity;
        const wasVerified = shared
          ? Boolean(product.parent.stockVerifiedAt)
          : Boolean(product.stockVerifiedAt);
        const unitCost = Number(
          shared ? product.parent.purchasePrice || 0 : product.purchasePrice
        );
        const now = new Date();

        // Optimistic compare-and-set: do not discard a courier deduction
        // that happened while the manager was physically counting this SKU.
        const updated = shared
          ? await tx.productParent.updateMany({
              where: { id: product.parentId, stockQuantity: before },
              data: { stockQuantity: qty, stockVerifiedAt: now },
            })
          : await tx.product.updateMany({
              where: { id: product.id, quantity: before },
              data: { quantity: qty, stockVerifiedAt: now },
            });
        if (updated.count !== 1) {
          throw new Error(
            "Stock changed while you were entering this count. Reload, count again and retry."
          );
        }

        const delta = qty - before;
        await tx.productStockAdjustment.create({
          data: {
            adjustmentDate: bangladeshBusinessDateToUtc(adjustmentDate),
            adjustmentType: "SET_COUNT",
            productId: product.id,
            parentId: product.parentId,
            skuSnapshot: product.sku,
            productNameSnapshot: product.name,
            parentSkuSnapshot: product.parent.sku,
            stockOwnerType: shared ? "PRODUCT_PARENT" : "PRODUCT",
            stockOwnerId: shared ? product.parentId : product.id,
            enteredQuantity: qty,
            unitsPerSale: 1,
            adjustedStockUnits: Math.abs(delta),
            unitCost,
            adjustmentValue: Math.abs(delta) * unitCost,
            stockBefore: before,
            stockAfter: qty,
            reason,
            note: (note ? note + " | " : "") +
              (wasVerified ? "Existing verified physical count updated"
                : "First verified physical count; legacy quantity replaced"),
            createdByUserId: session.user.id,
            createdByName: session.user.name || session.user.username || "OMS User",
          },
        });

        return {
          sku: shared ? product.parent.sku : product.sku,
          units: Math.abs(delta),
          value: Math.abs(delta) * unitCost,
          breakdown: [{
            ownerSku: shared ? product.parent.sku : product.sku,
            units: Math.abs(delta),
            before,
            after: qty,
          }],
          verified: true,
          counted: true,
          firstCount: !wasVerified,
        };
      }

      const requirements = await resolvePhysicalRequirements(tx, product, qty);
      const isBundle = product.inventoryKind === "BUNDLE";
      const breakdown: Array<{
        ownerSku: string; ownerType: string; units: number;
        unitCost: number; before: number; after: number;
      }> = [];
      let allOwnersVerified = true;

      for (const owner of requirements) {
        const before = owner.available;
        let after: number;
        if (owner.ownerType === "PRODUCT_PARENT") {
          const record = await tx.productParent.findUnique({
            where: { id: owner.ownerId },
            select: { stockVerifiedAt: true },
          });
          allOwnersVerified = allOwnersVerified && Boolean(record?.stockVerifiedAt);
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
          const record = await tx.product.findUnique({
            where: { id: owner.ownerId },
            select: { stockVerifiedAt: true },
          });
          allOwnersVerified = allOwnersVerified && Boolean(record?.stockVerifiedAt);
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
          unitCost: units
            ? Math.round(value / units * 100) / 100
            : 0,
          adjustmentValue: value,
          stockBefore: isBundle ? 0 : first.before,
          stockAfter: isBundle ? 0 : first.after,
          componentBreakdown: isBundle ? JSON.stringify(breakdown) : null,
          reason, note: note || null,
          createdByUserId: session.user.id,
          createdByName: session.user.name || session.user.username || "OMS User",
        },
      });

      return {
        sku: product.sku,
        units,
        value,
        breakdown,
        verified: allOwnersVerified,
        counted: false,
        firstCount: false,
      };
    });

    revalidatePath("/dashboard/stock-adjustments");
    revalidatePath("/dashboard/damage-products");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");
    revalidatePath("/dashboard/products/bundles");

    if (result.counted) {
      return {
        success: true,
        message: "Physical stock verified for " + result.sku +
          ". Actual stock: " + result.breakdown[0].before +
          " → " + result.breakdown[0].after + ". " +
          (result.firstCount
            ? "Legacy stock is now eligible for valuation."
            : "The verified stock balance has been updated."),
      };
    }

    const verb = type === "ADD" ? "added to" : "removed from";
    return {
      success: true,
      warning: !result.verified ||
        result.breakdown.some((row) => row.after < 0),
      message: "Adjustment saved for " + result.sku + ": " +
        result.units + " physical units " + verb + " inventory, value BDT " +
        result.value.toFixed(2) + ". " +
        result.breakdown.map((row) =>
          row.ownerSku + " " + row.before + " → " + row.after
        ).join("; ") + "." +
        (!result.verified
          ? " Some stock balances remain unverified and excluded from valuation. Use Set Physical Count to certify them."
          : ""),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to adjust stock.",
    };
  }
}
