"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { bangladeshBusinessDateToUtc } from "@/lib/bangladesh-time";
import { enqueueStockSyncForOwners } from "@/lib/product-catalog-sync";

export type LocalProductPurchaseActionState = {
  success: boolean;
  message: string;
  warning?: boolean;
};

function cleanMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  const number = Number(raw || 0);
  return Number.isFinite(number) ? number : NaN;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createLocalProductPurchase(
  _previousState: LocalProductPurchaseActionState,
  formData: FormData
): Promise<LocalProductPurchaseActionState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      throw new Error("Unauthorized.");
    }

    const productId = String(formData.get("productId") || "").trim();
    const purchaseDate = String(formData.get("purchaseDate") || "").trim();
    const rawQty = String(formData.get("quantity") || "").trim();
    const quantity = Number(rawQty);
    const unitPurchaseCost = cleanMoney(formData.get("unitPurchaseCost"));
    const transportCost = cleanMoney(formData.get("transportCost"));
    const otherCost = cleanMoney(formData.get("otherCost"));
    const note = String(formData.get("note") || "").trim();

    if (!productId) {
      return { success: false, message: "Select a Product SKU." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      return { success: false, message: "Select a valid purchase date." };
    }
    if (!rawQty || !Number.isSafeInteger(quantity) || quantity < 1) {
      return { success: false, message: "Purchase quantity must be a positive whole number." };
    }
    if (!Number.isFinite(unitPurchaseCost) || unitPurchaseCost <= 0) {
      return { success: false, message: "Unit purchase cost must be greater than 0." };
    }
    if (!Number.isFinite(transportCost) || transportCost < 0) {
      return { success: false, message: "Vara / transport cost cannot be negative." };
    }
    if (!Number.isFinite(otherCost) || otherCost < 0) {
      return { success: false, message: "Other cost cannot be negative." };
    }

    const { prisma } = await import("@/lib/prisma");

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { parent: true },
      });

      if (!product || !product.status || !product.parent.status) {
        throw new Error("Product SKU is missing or inactive.");
      }

      if (product.inventoryKind !== "PHYSICAL") {
        throw new Error(
          "A virtual bundle cannot be purchased directly. Purchase its real component SKU instead."
        );
      }

      const parentStock = product.parent.stockMode === "PARENT_STOCK";
      const unitsPerSale = parentStock
        ? Math.max(1, Number(product.unitsPerSale || 1))
        : 1;
      const addedStockUnits = quantity * unitsPerSale;

      const productCostTotal = round2(quantity * unitPurchaseCost);
      const grandTotalCost = round2(
        productCostTotal + transportCost + otherCost
      );
      const landedUnitCost = round2(grandTotalCost / addedStockUnits);

      const stockBefore = parentStock
        ? Number(product.parent.stockQuantity || 0)
        : Number(product.quantity || 0);
      const stockAfter = stockBefore + addedStockUnits;
      const previousBuyingPrice = round2(
        Number(
          parentStock
            ? product.parent.purchasePrice || 0
            : product.purchasePrice || 0
        )
      );
      const stockWasVerified = parentStock
        ? Boolean(product.parent.stockVerifiedAt)
        : Boolean(product.stockVerifiedAt);

      // Buying price becomes the latest landed purchase cost for the physical
      // stock owner. A Parent Stock SKU stores cost per physical parent unit.
      if (parentStock) {
        const updated = await tx.productParent.updateMany({
          where: {
            id: product.parentId,
            stockQuantity: stockBefore,
          },
          data: {
            stockQuantity: stockAfter,
            purchasePrice: landedUnitCost,
          },
        });

        if (updated.count !== 1) {
          throw new Error(
            "Shared parent stock changed while this purchase was being saved. Reload and submit again."
          );
        }
      } else {
        const updated = await tx.product.updateMany({
          where: {
            id: product.id,
            quantity: stockBefore,
          },
          data: {
            quantity: stockAfter,
            purchasePrice: landedUnitCost,
          },
        });

        if (updated.count !== 1) {
          throw new Error(
            "SKU stock changed while this purchase was being saved. Reload and submit again."
          );
        }
      }

      const purchaseDetail = {
        kind: "LOCAL_PRODUCT_PURCHASE",
        unitPurchaseCost: round2(unitPurchaseCost),
        productCostTotal,
        transportCost: round2(transportCost),
        otherCost: round2(otherCost),
        grandTotalCost,
        landedUnitCost,
        previousBuyingPrice,
        newBuyingPrice: landedUnitCost,
        stockWasVerified,
        userNote: note || null,
      };

      await tx.productStockAdjustment.create({
        data: {
          adjustmentDate: bangladeshBusinessDateToUtc(purchaseDate),
          adjustmentType: "ADD",
          productId: product.id,
          parentId: product.parentId,
          skuSnapshot: product.sku,
          productNameSnapshot: product.name,
          parentSkuSnapshot: product.parent.sku,
          stockOwnerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          stockOwnerId: parentStock ? product.parentId : product.id,
          enteredQuantity: quantity,
          unitsPerSale,
          adjustedStockUnits: addedStockUnits,
          componentBreakdown: JSON.stringify(purchaseDetail),
          unitCost: landedUnitCost,
          adjustmentValue: grandTotalCost,
          stockBefore,
          stockAfter,
          reason: "Local Product Purchase",
          note: note || null,
          createdByUserId: session.user.id,
          createdByName:
            session.user.name || session.user.username || "OMS User",
        },
      });

      await enqueueStockSyncForOwners(tx, [
        {
          ownerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          ownerId: parentStock ? product.parentId : product.id,
        },
      ]);

      return {
        sku: product.sku,
        parentSku: product.parent.sku,
        parentStock,
        quantity,
        unitsPerSale,
        addedStockUnits,
        stockBefore,
        stockAfter,
        grandTotalCost,
        landedUnitCost,
        previousBuyingPrice,
        stockWasVerified,
      };
    });

    revalidatePath("/dashboard/products-purchases/local-purchase");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-adjustments");
    revalidatePath("/dashboard/stock-valuation");
    revalidatePath("/dashboard/profit-margin");

    const stockLabel = result.parentStock
      ? result.parentSku + " shared parent stock"
      : result.sku + " stock";

    return {
      success: true,
      warning: !result.stockWasVerified,
      message:
        "Local purchase saved. " +
        result.sku +
        ": purchased " +
        result.quantity +
        " unit(s), added " +
        result.addedStockUnits +
        " physical stock unit(s) to " +
        stockLabel +
        " (" +
        result.stockBefore +
        " → " +
        result.stockAfter +
        "). Total landed cost BDT " +
        result.grandTotalCost.toFixed(2) +
        ". Buying price " +
        result.previousBuyingPrice.toFixed(2) +
        " → " +
        result.landedUnitCost.toFixed(2) +
        "." +
        (!result.stockWasVerified
          ? " This stock owner was already unverified, so the balance remains excluded from Stock Valuation until an exact Physical Count is entered."
          : ""),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save local product purchase.",
    };
  }
}
