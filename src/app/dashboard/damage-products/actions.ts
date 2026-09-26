"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";
import { resolvePhysicalRequirements } from "@/lib/inventory";

export type DamageEntryActionState = {
  success: boolean;
  message: string;
  warning?: boolean;
};

export async function createProductDamageEntry(
  _prevState: DamageEntryActionState,
  formData: FormData
): Promise<DamageEntryActionState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      throw new Error("Unauthorized");
    }

    const productId = String(formData.get("productId") || "").trim();
    const damageDate = String(formData.get("damageDate") || "").trim();
    const enteredQuantity = Number(formData.get("quantity"));
    const note = String(formData.get("note") || "").trim();

    if (!productId) return { success: false, message: "Select a valid SKU." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(damageDate)) {
      return { success: false, message: "Select a valid damage date." };
    }
    if (!Number.isSafeInteger(enteredQuantity) || enteredQuantity < 1) {
      return { success: false, message: "Damage quantity must be a positive whole number." };
    }

    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId }, include: { parent: true },
      });
      if (!product) throw new Error("Product SKU not found.");

      const owners = await resolvePhysicalRequirements(tx, product, enteredQuantity);
      const isBundle = product.inventoryKind === "BUNDLE";
      const breakdown: Array<{
        ownerSku: string; ownerType: string;
        units: number; unitCost: number; before: number; after: number;
      }> = [];

      for (const owner of owners) {
        const before = owner.available;
        let after: number;
        if (owner.ownerType === "PRODUCT_PARENT") {
          const updated = await tx.productParent.update({
            where: { id: owner.ownerId },
            data: { stockQuantity: { decrement: owner.requiredUnits } },
            select: { stockQuantity: true },
          });
          after = updated.stockQuantity;
        } else {
          const updated = await tx.product.update({
            where: { id: owner.ownerId },
            data: { quantity: { decrement: owner.requiredUnits } },
            select: { quantity: true },
          });
          after = updated.quantity;
        }
        breakdown.push({
          ownerSku: owner.ownerLabel, ownerType: owner.ownerType,
          units: owner.requiredUnits, unitCost: owner.unitCost,
          before, after,
        });
      }

      const physicalUnits = breakdown.reduce((sum, row) => sum + row.units, 0);
      const damageValue = Math.round(
        breakdown.reduce((sum, row) => sum + row.units * row.unitCost, 0) * 100
      ) / 100;
      const first = breakdown[0];

      await tx.productDamageEntry.create({
        data: {
          damageDate: bangladeshBusinessDateToUtc(damageDate),
          productId: product.id,
          parentId: product.parentId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          parentSkuSnapshot: product.parent.sku,
          stockOwnerType: isBundle ? "PRODUCT" : first.ownerType,
          stockOwnerId: isBundle ? product.id : owners[0].ownerId,
          enteredQuantity,
          unitsPerSale: isBundle ? physicalUnits / enteredQuantity : owners[0].unitsPerSale,
          damagedStockUnits: physicalUnits,
          unitCost: physicalUnits ? Math.round(damageValue / physicalUnits * 100) / 100 : 0,
          damageValue,
          stockBefore: isBundle ? 0 : first.before,
          stockAfter: isBundle ? 0 : first.after,
          componentBreakdown: isBundle ? JSON.stringify(breakdown) : null,
          note: note || null,
          createdByUserId: session.user.id,
          createdByName: session.user.name || session.user.username || "OMS User",
        },
      });

      return {
        sku: product.sku,
        physicalUnits,
        damageValue,
        breakdown,
      };
    });

    revalidatePath("/dashboard/damage-products");
    revalidatePath("/dashboard/stock-adjustments");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      warning: result.breakdown.some((part) => part.after < 0),
      message: "Damage recorded for " + result.sku +
        ": " + result.physicalUnits + " physical unit(s), BDT " +
        result.damageValue.toFixed(2) + ". " +
        result.breakdown.map((part) =>
          part.ownerSku + " " + part.before + " → " + part.after
        ).join("; ") + ".",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to record damage.",
    };
  }
}
