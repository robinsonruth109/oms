"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { applyStockMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

function intValue(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function moneyValue(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(String(value ?? fallback).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function done(message: string) {
  redirect("/dashboard/inventory?message=" + encodeURIComponent(message));
}

export async function activateInventory(formData: FormData) {
  const session = await requireAdmin();
  const parentId = String(formData.get("parentId") || "").trim();
  const inventoryMode = String(formData.get("inventoryMode") || "").trim();

  if (
    !parentId ||
    !["SHARED_PARENT", "CHILD_VARIANT"].includes(inventoryMode)
  ) {
    done("Choose a valid inventory mode.");
  }

  const parent = await prisma.productParent.findUnique({
    where: { id: parentId },
    include: { products: { orderBy: { sku: "asc" } } },
  });

  if (!parent) done("Product Parent not found.");
  if (parent!.stockTrackingActive) {
    done("Stock tracking is already active for this Product Parent.");
  }

  await prisma.$transaction(async (tx) => {
    for (const product of parent!.products) {
      const unitsPerSale = Math.max(
        1,
        intValue(formData.get("unitsPerSale_" + product.id), product.quantity)
      );
      await tx.product.update({
        where: { id: product.id },
        data: { quantity: unitsPerSale },
      });
    }

    const activatedAt = new Date();

    if (inventoryMode === "SHARED_PARENT") {
      const openingQty = intValue(formData.get("openingQty"), 0);
      const openingCost = moneyValue(formData.get("openingCost"), 0);

      await tx.productParent.update({
        where: { id: parentId },
        data: {
          inventoryMode: "SHARED_PARENT",
          stockTrackingActive: true,
          stockActivatedAt: activatedAt,
          stockQuantity: openingQty,
          averageCost: openingCost,
        },
      });

      await tx.product.updateMany({
        where: { parentId },
        data: { stockQuantity: 0, averageCost: 0 },
      });

      await tx.stockMovement.create({
        data: {
          productParentId: parentId,
          productId: null,
          movementType: "OPENING",
          quantityDelta: openingQty,
          balanceBefore: 0,
          balanceAfter: openingQty,
          unitCost: openingCost,
          averageCostBefore: 0,
          averageCostAfter: openingCost,
          stockValueAfter: openingQty * openingCost,
          referenceType: "INVENTORY_ACTIVATION",
          referenceId: parentId,
          idempotencyKey: "OPENING:PARENT:" + parentId,
          note: "Opening stock entered when stock tracking was activated.",
          createdByUserId: session.user.id,
        },
      });
    } else {
      await tx.productParent.update({
        where: { id: parentId },
        data: {
          inventoryMode: "CHILD_VARIANT",
          stockTrackingActive: true,
          stockActivatedAt: activatedAt,
          stockQuantity: 0,
          averageCost: 0,
        },
      });

      for (const product of parent!.products) {
        const openingQty = intValue(
          formData.get("openingQty_" + product.id),
          0
        );
        const openingCost = moneyValue(
          formData.get("openingCost_" + product.id),
          Number(product.purchasePrice)
        );

        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: openingQty,
            averageCost: openingCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            productParentId: parentId,
            productId: product.id,
            movementType: "OPENING",
            quantityDelta: openingQty,
            balanceBefore: 0,
            balanceAfter: openingQty,
            unitCost: openingCost,
            averageCostBefore: 0,
            averageCostAfter: openingCost,
            stockValueAfter: openingQty * openingCost,
            referenceType: "INVENTORY_ACTIVATION",
            referenceId: parentId,
            idempotencyKey: "OPENING:PRODUCT:" + product.id,
            note: "Opening variant stock entered when stock tracking was activated.",
            createdByUserId: session.user.id,
          },
        });
      }
    }
  }, { timeout: 30_000 });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  done("Stock tracking activated. Historical orders before activation were not applied.");
}

export async function setActualStock(formData: FormData) {
  const session = await requireAdmin();
  const productId = String(formData.get("productId") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim();
  const actualQty = intValue(formData.get("actualQty"), 0);
  const note = String(formData.get("note") || "").trim();

  const parent = await prisma.productParent.findUnique({
    where: { id: parentId },
    include: { products: true },
  });

  if (!parent || !parent.stockTrackingActive) {
    done("Stock tracking is not active for this Product Parent.");
  }

  const targetProduct =
    parent!.inventoryMode === "CHILD_VARIANT"
      ? parent!.products.find((item) => item.id === productId)
      : parent!.products[0];

  if (!targetProduct) done("Stock target product was not found.");

  const currentQty =
    parent!.inventoryMode === "SHARED_PARENT"
      ? parent!.stockQuantity
      : targetProduct!.stockQuantity;

  const delta = actualQty - currentQty;

  if (!delta) done("Stock already matches the entered actual quantity.");

  await applyStockMovement(prisma, {
    productId: targetProduct!.id,
    movementType: "MANUAL_ADJUSTMENT",
    quantityDelta: delta,
    idempotencyKey:
      "MANUAL_ADJUSTMENT:" +
      parentId +
      ":" +
      (productId || "PARENT") +
      ":" +
      Date.now(),
    referenceType: "MANUAL_STOCK_COUNT",
    referenceId: parentId,
    note: note || "Actual stock count adjustment.",
    createdByUserId: session.user.id,
  });

  revalidatePath("/dashboard/inventory");
  done("Actual stock updated successfully.");
}
