import type { StockMovementType } from "@prisma/client";

type DbLike = any;

export type StockMovementResult = {
  applied: boolean;
  reason?: string;
  movementId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  averageCostAfter?: number;
  inventoryMode?: "LEGACY" | "SHARED_PARENT" | "CHILD_VARIANT";
};

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function applyStockMovement(
  db: DbLike,
  input: {
    productId: string;
    movementType: StockMovementType;
    quantityDelta: number;
    idempotencyKey: string;
    unitCost?: number | null;
    referenceType?: string | null;
    referenceId?: string | null;
    note?: string | null;
    createdByUserId?: string | null;
  }
): Promise<StockMovementResult> {
  const quantityDelta = Math.trunc(Number(input.quantityDelta || 0));

  if (!quantityDelta) {
    return { applied: false, reason: "ZERO_DELTA" };
  }

  const duplicate = await db.stockMovement.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, balanceBefore: true, balanceAfter: true, averageCostAfter: true },
  });

  if (duplicate) {
    return {
      applied: false,
      reason: "ALREADY_APPLIED",
      movementId: duplicate.id,
      balanceBefore: duplicate.balanceBefore,
      balanceAfter: duplicate.balanceAfter,
      averageCostAfter: n(duplicate.averageCostAfter),
    };
  }

  const product = await db.product.findUnique({
    where: { id: input.productId },
    include: { parent: true },
  });

  if (!product) {
    return { applied: false, reason: "PRODUCT_NOT_FOUND" };
  }

  const parent = product.parent;

  if (!parent.stockTrackingActive || parent.inventoryMode === "LEGACY") {
    return {
      applied: false,
      reason: "TRACKING_NOT_ACTIVE",
      inventoryMode: parent.inventoryMode,
    };
  }

  const shared = parent.inventoryMode === "SHARED_PARENT";
  const balanceBefore = shared
    ? Number(parent.stockQuantity)
    : Number(product.stockQuantity);
  const averageCostBefore = shared
    ? n(parent.averageCost)
    : n(product.averageCost);
  const balanceAfter = balanceBefore + quantityDelta;

  let averageCostAfter = averageCostBefore;
  const incomingUnitCost =
    input.unitCost == null ? null : Math.max(0, n(input.unitCost));

  // Weighted-average cost changes only when genuinely new purchased stock
  // enters inventory. Returns preserve the cost already carried by inventory.
  if (
    input.movementType === "PURCHASE_RECEIVED" &&
    quantityDelta > 0 &&
    incomingUnitCost != null
  ) {
    const previousPositiveQty = Math.max(balanceBefore, 0);
    const resultingPositiveQty = previousPositiveQty + quantityDelta;

    averageCostAfter =
      resultingPositiveQty > 0
        ? (previousPositiveQty * averageCostBefore +
            quantityDelta * incomingUnitCost) /
          resultingPositiveQty
        : incomingUnitCost;
  }

  if (shared) {
    await db.productParent.update({
      where: { id: parent.id },
      data: {
        stockQuantity: balanceAfter,
        averageCost: averageCostAfter,
      },
    });
  } else {
    await db.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: balanceAfter,
        averageCost: averageCostAfter,
      },
    });
  }

  const movement = await db.stockMovement.create({
    data: {
      productParentId: parent.id,
      productId: shared ? null : product.id,
      movementType: input.movementType,
      quantityDelta,
      balanceBefore,
      balanceAfter,
      unitCost: incomingUnitCost,
      averageCostBefore,
      averageCostAfter,
      stockValueAfter: balanceAfter * averageCostAfter,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      idempotencyKey: input.idempotencyKey,
      note: input.note || null,
      createdByUserId: input.createdByUserId || null,
    },
    select: { id: true },
  });

  return {
    applied: true,
    movementId: movement.id,
    balanceBefore,
    balanceAfter,
    averageCostAfter,
    inventoryMode: parent.inventoryMode,
  };
}

export async function deductOrderInventory(
  db: DbLike,
  input: {
    orderId: string;
    createdByUserId?: string | null;
    referenceType?: string;
  }
) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: {
        include: {
          product: {
            include: { parent: true },
          },
        },
      },
    },
  });

  if (!order) {
    return { appliedMovements: 0, warnings: ["Order not found."] };
  }

  let appliedMovements = 0;
  const warnings: string[] = [];

  for (const item of order.items) {
    const product =
      item.product ||
      (await db.product.findUnique({
        where: { sku: item.productSku },
        include: { parent: true },
      }));

    if (!product) {
      warnings.push(`${item.productSku}: not linked to Product Master.`);
      continue;
    }

    const physicalUnitsPerSale = Math.max(1, Number(product.quantity || 1));
    const physicalQty = Number(item.quantity || 0) * physicalUnitsPerSale;

    const result = await applyStockMovement(db, {
      productId: product.id,
      movementType: "CSV_DISPATCH",
      quantityDelta: -physicalQty,
      idempotencyKey: `CSV_DISPATCH:${order.id}:${item.id}`,
      referenceType: input.referenceType || "ORDER_CSV",
      referenceId: order.id,
      note: `${item.productSku}: ${item.quantity} sold SKU x ${physicalUnitsPerSale} physical unit(s)`,
      createdByUserId: input.createdByUserId,
    });

    if (result.applied) {
      appliedMovements += 1;
      if ((result.balanceAfter ?? 0) <= 0) {
        warnings.push(
          `${product.parent.sku}/${product.sku}: stock is now ${result.balanceAfter}. Flow was not blocked.`
        );
      }
    }
  }

  return { appliedMovements, warnings };
}

export async function restoreReturnedInventory(
  db: DbLike,
  input: {
    orderId: string;
    orderItemId: string;
    productId: string;
    returnedSoldQty: number;
    returnReference: string;
    createdByUserId?: string | null;
  }
) {
  const dispatch = await db.stockMovement.findUnique({
    where: {
      idempotencyKey: `CSV_DISPATCH:${input.orderId}:${input.orderItemId}`,
    },
    select: { id: true, quantityDelta: true },
  });

  // A return from an order dispatched before activation must not create stock.
  if (!dispatch) {
    return { applied: false, reason: "NO_TRACKED_DISPATCH" };
  }

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, sku: true },
  });

  if (!product) {
    return { applied: false, reason: "PRODUCT_NOT_FOUND" };
  }

  const orderItem = await db.orderItem.findUnique({
    where: { id: input.orderItemId },
    select: { quantity: true },
  });

  if (!orderItem || orderItem.quantity <= 0) {
    return { applied: false, reason: "ORDER_ITEM_NOT_FOUND" };
  }

  const totalPhysicalDeducted = Math.abs(Number(dispatch.quantityDelta || 0));
  const physicalUnitsPerSoldSku =
    totalPhysicalDeducted / Number(orderItem.quantity || 1);
  const physicalQty = Math.round(
    Math.max(0, Math.trunc(Number(input.returnedSoldQty || 0))) *
      physicalUnitsPerSoldSku
  );

  return applyStockMovement(db, {
    productId: product.id,
    movementType: "PATHAO_RETURN",
    quantityDelta: physicalQty,
    idempotencyKey: `PATHAO_RETURN:${input.returnReference}:${input.orderItemId}`,
    referenceType: "PATHAO_RETURN",
    referenceId: input.returnReference,
    note: `${product.sku}: ${input.returnedSoldQty} returned sold SKU, restoring ${physicalQty} physical unit(s) from original dispatch movement.`,
    createdByUserId: input.createdByUserId,
  });
}
