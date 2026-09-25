"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";

export type DamageEntryActionState = {
  success: boolean;
  message: string;
  warning?: boolean;
};

async function requireDamageAccess() {
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

export async function createProductDamageEntry(
  _prevState: DamageEntryActionState,
  formData: FormData
): Promise<DamageEntryActionState> {
  try {
    const session = await requireDamageAccess();
    const productId = String(formData.get("productId") || "").trim();
    const damageDate = String(formData.get("damageDate") || "").trim();
    const enteredQuantity = positiveInt(formData.get("quantity"));
    const note = String(formData.get("note") || "").trim();

    if (!productId) {
      return { success: false, message: "Select a valid product SKU." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(damageDate)) {
      return { success: false, message: "Select a valid damage date." };
    }

    if (!enteredQuantity) {
      return {
        success: false,
        message: "Damage quantity must be at least 1.",
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
      const damagedStockUnits = parentStock
        ? enteredQuantity * unitsPerSale
        : enteredQuantity;
      const unitCost = parentStock
        ? Number(product.parent.purchasePrice || 0)
        : Number(product.purchasePrice || 0);

      const stockBefore = parentStock
        ? Number(product.parent.stockQuantity || 0)
        : Number(product.quantity || 0);
      const stockAfter = stockBefore - damagedStockUnits;
      const damageValue = damagedStockUnits * unitCost;

      if (parentStock) {
        await tx.productParent.update({
          where: { id: product.parentId },
          data: {
            stockQuantity: { decrement: damagedStockUnits },
          },
        });
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity: { decrement: damagedStockUnits },
          },
        });
      }

      await tx.productDamageEntry.create({
        data: {
          damageDate: bangladeshBusinessDateToUtc(damageDate),
          productId: product.id,
          parentId: product.parentId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          parentSkuSnapshot: product.parent.sku,
          stockOwnerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          stockOwnerId: parentStock ? product.parentId : product.id,
          enteredQuantity,
          unitsPerSale: parentStock ? unitsPerSale : 1,
          damagedStockUnits,
          unitCost,
          damageValue,
          stockBefore,
          stockAfter,
          note: note || null,
          createdByUserId: session.user.id,
          createdByName:
            session.user.name || session.user.username || "OMS User",
        },
      });

      return {
        sku: product.sku,
        damagedStockUnits,
        damageValue,
        stockBefore,
        stockAfter,
      };
    });

    revalidatePath("/dashboard/damage-products");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      warning: result.stockAfter < 0,
      message:
        `Damage recorded for ${result.sku}. ${result.damagedStockUnits} physical stock unit(s) deducted. Damage value: BDT ${result.damageValue.toFixed(2)}. Stock: ${result.stockBefore} → ${result.stockAfter}.` +
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
          : "Failed to record damaged product.",
    };
  }
}
