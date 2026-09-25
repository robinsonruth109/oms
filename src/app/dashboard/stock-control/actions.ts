"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type StockActionState = {
  success: boolean;
  message: string;
};

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function saveStockSetup(
  _prevState: StockActionState,
  formData: FormData
): Promise<StockActionState> {
  try {
    const session = await requireAdmin();

    const parentId = String(formData.get("parentId") || "").trim();
    const productId = String(formData.get("productId") || "").trim();
    const mode = String(formData.get("mode") || "").trim();
    const desiredQuantity = Math.trunc(numberValue(formData.get("quantity")));
    const desiredAverageCost = numberValue(formData.get("averageCost"));
    const note = String(formData.get("note") || "").trim();

    if (!parentId || !["SHARED_PARENT", "VARIANT"].includes(mode)) {
      return {
        success: false,
        message: "Parent and inventory mode are required.",
      };
    }

    if (desiredAverageCost < 0) {
      return {
        success: false,
        message: "Average cost cannot be negative.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const parent = await tx.productParent.findUnique({
        where: { id: parentId },
        include: {
          inventoryStock: true,
          products: {
            include: {
              inventoryStock: true,
            },
          },
        },
      });

      if (!parent) {
        throw new Error("Product Parent not found.");
      }

      if (parent.inventoryMode && parent.inventoryMode !== mode) {
        throw new Error(
          `Inventory mode is already locked as ${parent.inventoryMode}. Existing tracked stock must not be silently converted.`
        );
      }

      if (mode === "SHARED_PARENT") {
        if (parent.products.some((product) => product.inventoryStock)) {
          throw new Error(
            "This parent already has child/variant stock activated and cannot be converted to shared stock."
          );
        }

        await tx.productParent.update({
          where: { id: parent.id },
          data: { inventoryMode: "SHARED_PARENT" },
        });

        if (!parent.inventoryStock) {
          const stock = await tx.inventoryStock.create({
            data: {
              parentId: parent.id,
              quantity: desiredQuantity,
              averageCost: desiredAverageCost,
              activatedAt: new Date(),
            },
          });

          await tx.inventoryMovement.create({
            data: {
              inventoryStockId: stock.id,
              movementType: "OPENING_STOCK",
              quantityChange: desiredQuantity,
              balanceBefore: 0,
              balanceAfter: desiredQuantity,
              unitCost: desiredAverageCost,
              averageCostBefore: 0,
              averageCostAfter: desiredAverageCost,
              dedupeKey: `OPENING:${stock.id}`,
              note:
                note ||
                `Opening physical stock for shared parent ${parent.sku}. Historical assumed stock is ignored.`,
              createdByUserId: session.user.id,
            },
          });

          return {
            label: parent.sku,
            quantity: desiredQuantity,
            activated: true,
          };
        }

        const beforeQty = parent.inventoryStock.quantity;
        const beforeCost = Number(parent.inventoryStock.averageCost || 0);
        const delta = desiredQuantity - beforeQty;

        await tx.inventoryStock.update({
          where: { id: parent.inventoryStock.id },
          data: {
            quantity: desiredQuantity,
            averageCost: desiredAverageCost,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryStockId: parent.inventoryStock.id,
            movementType: "MANUAL_ADJUSTMENT",
            quantityChange: delta,
            balanceBefore: beforeQty,
            balanceAfter: desiredQuantity,
            unitCost: desiredAverageCost,
            averageCostBefore: beforeCost,
            averageCostAfter: desiredAverageCost,
            dedupeKey: `MANUAL:${parent.inventoryStock.id}:${Date.now()}:${Math.random()}`,
            note:
              note ||
              `Admin physical stock count adjustment for shared parent ${parent.sku}.`,
            createdByUserId: session.user.id,
          },
        });

        return {
          label: parent.sku,
          quantity: desiredQuantity,
          activated: false,
        };
      }

      if (!productId) {
        throw new Error("Select a child SKU for Variant stock.");
      }

      if (parent.inventoryStock) {
        throw new Error(
          "This parent already has shared stock activated and cannot be converted to child/variant stock."
        );
      }

      const product = parent.products.find((item) => item.id === productId);
      if (!product) {
        throw new Error("Selected child SKU does not belong to this parent.");
      }

      await tx.productParent.update({
        where: { id: parent.id },
        data: { inventoryMode: "VARIANT" },
      });

      if (!product.inventoryStock) {
        const stock = await tx.inventoryStock.create({
          data: {
            productId: product.id,
            quantity: desiredQuantity,
            averageCost: desiredAverageCost,
            activatedAt: new Date(),
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryStockId: stock.id,
            movementType: "OPENING_STOCK",
            quantityChange: desiredQuantity,
            balanceBefore: 0,
            balanceAfter: desiredQuantity,
            unitCost: desiredAverageCost,
            averageCostBefore: 0,
            averageCostAfter: desiredAverageCost,
            dedupeKey: `OPENING:${stock.id}`,
            note:
              note ||
              `Opening physical stock for variant SKU ${product.sku}. Historical assumed stock is ignored.`,
            createdByUserId: session.user.id,
          },
        });

        return {
          label: product.sku,
          quantity: desiredQuantity,
          activated: true,
        };
      }

      const beforeQty = product.inventoryStock.quantity;
      const beforeCost = Number(product.inventoryStock.averageCost || 0);
      const delta = desiredQuantity - beforeQty;

      await tx.inventoryStock.update({
        where: { id: product.inventoryStock.id },
        data: {
          quantity: desiredQuantity,
          averageCost: desiredAverageCost,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryStockId: product.inventoryStock.id,
          movementType: "MANUAL_ADJUSTMENT",
          quantityChange: delta,
          balanceBefore: beforeQty,
          balanceAfter: desiredQuantity,
          unitCost: desiredAverageCost,
          averageCostBefore: beforeCost,
          averageCostAfter: desiredAverageCost,
          dedupeKey: `MANUAL:${product.inventoryStock.id}:${Date.now()}:${Math.random()}`,
          note:
            note ||
            `Admin physical stock count adjustment for variant SKU ${product.sku}.`,
          createdByUserId: session.user.id,
        },
      });

      return {
        label: product.sku,
        quantity: desiredQuantity,
        activated: false,
      };
    }, { timeout: 30_000 });

    revalidatePath("/dashboard/stock-control");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: result.activated
        ? `${result.label} stock tracking activated at ${result.quantity} physical unit(s). Previous assumed stock/history was ignored.`
        : `${result.label} actual stock updated to ${result.quantity} physical unit(s). Adjustment was logged.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message === "Unauthorized"
            ? "Unauthorized action."
            : error.message
          : "Failed to update stock.",
    };
  }
}
