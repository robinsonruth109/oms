import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type ResolvedTarget = {
  stock: {
    id: string;
    quantity: number;
    averageCost: unknown;
  };
  unitsPerSale: number;
  targetLabel: string;
};

async function resolveTarget(
  tx: Tx,
  productId: string
): Promise<ResolvedTarget | null> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      unitsPerSale: true,
      inventoryStock: {
        select: {
          id: true,
          quantity: true,
          averageCost: true,
        },
      },
      parent: {
        select: {
          id: true,
          sku: true,
          inventoryMode: true,
          inventoryStock: {
            select: {
              id: true,
              quantity: true,
              averageCost: true,
            },
          },
        },
      },
    },
  });

  if (!product) return null;

  const unitsPerSale = Math.max(1, Number(product.unitsPerSale || 1));

  if (
    product.parent.inventoryMode === "SHARED_PARENT" &&
    product.parent.inventoryStock
  ) {
    return {
      stock: product.parent.inventoryStock,
      unitsPerSale,
      targetLabel: product.parent.sku,
    };
  }

  if (
    product.parent.inventoryMode === "VARIANT" &&
    product.inventoryStock
  ) {
    return {
      stock: product.inventoryStock,
      unitsPerSale,
      targetLabel: product.sku,
    };
  }

  return null;
}

export type InventoryEffect = {
  tracked: boolean;
  physicalQty: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  warning?: string;
};

export async function applyInventorySaleForOrderTx(
  tx: Tx,
  orderId: string,
  actorUserId?: string | null
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      invoiceId: true,
      items: {
        select: {
          id: true,
          productId: true,
          productSku: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) {
    return { movements: 0, warnings: [] as string[] };
  }

  const grouped = new Map<
    string,
    {
      stockId: string;
      quantity: number;
      targetLabel: string;
    }
  >();

  for (const item of order.items) {
    let productId = item.productId;

    if (!productId) {
      const fallback = await tx.product.findUnique({
        where: { sku: item.productSku },
        select: { id: true },
      });
      productId = fallback?.id || null;
    }

    if (!productId) continue;

    const target = await resolveTarget(tx, productId);
    if (!target) continue;

    const physicalQty =
      Math.max(1, Number(item.quantity || 1)) * target.unitsPerSale;

    const existing = grouped.get(target.stock.id);
    if (existing) {
      existing.quantity += physicalQty;
    } else {
      grouped.set(target.stock.id, {
        stockId: target.stock.id,
        quantity: physicalQty,
        targetLabel: target.targetLabel,
      });
    }
  }

  const warnings: string[] = [];
  let movements = 0;

  for (const row of grouped.values()) {
    const dedupeKey = `SALE_CSV:${order.id}:${row.stockId}`;
    const duplicate = await tx.inventoryMovement.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });

    if (duplicate) continue;

    const before = await tx.inventoryStock.findUnique({
      where: { id: row.stockId },
      select: { quantity: true, averageCost: true },
    });

    if (!before) continue;

    const updated = await tx.inventoryStock.update({
      where: { id: row.stockId },
      data: {
        quantity: {
          decrement: row.quantity,
        },
      },
      select: {
        quantity: true,
        averageCost: true,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        inventoryStockId: row.stockId,
        movementType: "SALE_CSV",
        quantityChange: -row.quantity,
        balanceBefore: before.quantity,
        balanceAfter: updated.quantity,
        averageCostBefore: Number(before.averageCost || 0),
        averageCostAfter: Number(updated.averageCost || 0),
        orderId: order.id,
        dedupeKey,
        note: `Stock issued when invoice ${order.invoiceId || order.id} successfully left Non CSV.`,
        createdByUserId: actorUserId || null,
      },
    });

    movements += 1;

    if (updated.quantity <= 0) {
      warnings.push(
        `${row.targetLabel} stock is now ${updated.quantity}. Flow was not blocked.`
      );
    }
  }

  return { movements, warnings };
}

export async function applyInventoryPurchaseReceiptTx(
  tx: Tx,
  purchaseReceivedOrderId: string,
  actorUserId?: string | null
) {
  const received = await tx.purchaseReceivedOrder.findUnique({
    where: { id: purchaseReceivedOrderId },
    select: {
      id: true,
      receivedQty: true,
      unitOriginalCost: true,
      purchaseOrder: {
        select: {
          invoiceNo: true,
          productId: true,
        },
      },
    },
  });

  if (!received) {
    return { tracked: false, warning: "" };
  }

  const target = await resolveTarget(tx, received.purchaseOrder.productId);
  if (!target) {
    return { tracked: false, warning: "" };
  }

  const dedupeKey =
    `PURCHASE_RECEIVED:${received.id}:${target.stock.id}`;

  const duplicate = await tx.inventoryMovement.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });

  if (duplicate) {
    return { tracked: true, warning: "" };
  }

  const before = await tx.inventoryStock.findUnique({
    where: { id: target.stock.id },
    select: {
      quantity: true,
      averageCost: true,
    },
  });

  if (!before) {
    return { tracked: false, warning: "" };
  }

  // Purchase received quantity is always physical base-unit quantity.
  // It is NOT multiplied by Product.quantity / Units per Sale.
  const incomingQty = Math.max(0, Number(received.receivedQty || 0));
  const incomingCost = Number(received.unitOriginalCost || 0);
  const oldQty = Number(before.quantity || 0);
  const oldAverage = Number(before.averageCost || 0);
  const newQty = oldQty + incomingQty;

  let newAverage = oldAverage;

  if (incomingQty > 0) {
    if (oldQty > 0 && newQty > 0) {
      newAverage =
        (oldQty * oldAverage + incomingQty * incomingCost) / newQty;
    } else {
      // When stock was zero/negative, the newest received landed cost
      // becomes the clean valuation basis for the recovered stock.
      newAverage = incomingCost;
    }
  }

  const updated = await tx.inventoryStock.update({
    where: { id: target.stock.id },
    data: {
      quantity: {
        increment: incomingQty,
      },
      averageCost: newAverage,
    },
    select: {
      quantity: true,
      averageCost: true,
    },
  });

  await tx.inventoryMovement.create({
    data: {
      inventoryStockId: target.stock.id,
      movementType: "PURCHASE_RECEIVED",
      quantityChange: incomingQty,
      balanceBefore: oldQty,
      balanceAfter: updated.quantity,
      unitCost: incomingCost,
      averageCostBefore: oldAverage,
      averageCostAfter: Number(updated.averageCost || 0),
      purchaseReceivedOrderId: received.id,
      dedupeKey,
      note: `Purchase receipt ${received.purchaseOrder.invoiceNo}: +${incomingQty} physical unit(s).`,
      createdByUserId: actorUserId || null,
    },
  });

  return {
    tracked: true,
    warning:
      updated.quantity <= 0
        ? `${target.targetLabel} stock is still ${updated.quantity} after receiving stock.`
        : "",
  };
}

export async function applyInventoryReturnForProductTx(
  tx: Tx,
  input: {
    productId: string;
    returnedOrderQty: number;
    orderItemId: string;
    pathaoReturnTrackId: string;
    actorUserId?: string | null;
  }
): Promise<InventoryEffect> {
  const target = await resolveTarget(tx, input.productId);

  if (!target) {
    return {
      tracked: false,
      physicalQty: 0,
      balanceBefore: null,
      balanceAfter: null,
    };
  }

  const physicalQty =
    Math.max(0, Number(input.returnedOrderQty || 0)) *
    target.unitsPerSale;

  const dedupeKey =
    `PATHAO_RETURN:${input.pathaoReturnTrackId}:${input.orderItemId}:${target.stock.id}`;

  const duplicate = await tx.inventoryMovement.findUnique({
    where: { dedupeKey },
    select: {
      balanceBefore: true,
      balanceAfter: true,
      quantityChange: true,
    },
  });

  if (duplicate) {
    return {
      tracked: true,
      physicalQty: Number(duplicate.quantityChange || 0),
      balanceBefore: duplicate.balanceBefore,
      balanceAfter: duplicate.balanceAfter,
    };
  }

  const before = await tx.inventoryStock.findUnique({
    where: { id: target.stock.id },
    select: {
      quantity: true,
      averageCost: true,
    },
  });

  if (!before) {
    return {
      tracked: false,
      physicalQty: 0,
      balanceBefore: null,
      balanceAfter: null,
    };
  }

  const updated = await tx.inventoryStock.update({
    where: { id: target.stock.id },
    data: {
      quantity: {
        increment: physicalQty,
      },
    },
    select: {
      quantity: true,
      averageCost: true,
    },
  });

  await tx.inventoryMovement.create({
    data: {
      inventoryStockId: target.stock.id,
      movementType: "PATHAO_RETURN",
      quantityChange: physicalQty,
      balanceBefore: before.quantity,
      balanceAfter: updated.quantity,
      averageCostBefore: Number(before.averageCost || 0),
      averageCostAfter: Number(updated.averageCost || 0),
      pathaoReturnTrackId: input.pathaoReturnTrackId,
      dedupeKey,
      note: `Pathao returned ${input.returnedOrderQty} order unit(s), restoring ${physicalQty} physical stock unit(s).`,
      createdByUserId: input.actorUserId || null,
    },
  });

  return {
    tracked: true,
    physicalQty,
    balanceBefore: before.quantity,
    balanceAfter: updated.quantity,
    warning:
      updated.quantity <= 0
        ? `${target.targetLabel} stock is now ${updated.quantity}. Flow was not blocked.`
        : undefined,
  };
}
