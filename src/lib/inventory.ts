import "server-only";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

function positiveInt(value: unknown, fallback = 1) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveProduct(db: any, item: any) {
  if (item.product?.parent) {
    return item.product;
  }

  const product = await db.product.findUnique({
    where: { sku: item.productSku },
    include: { parent: true },
  });

  if (!product) {
    throw new InventoryError(
      `Product ${item.productSku} is not linked to Product Master.`
    );
  }

  return product;
}

function ownerFor(product: any, orderQty: number) {
  const parentStock = product.parent.stockMode === "PARENT_STOCK";
  const unitsPerSale = positiveInt(product.unitsPerSale, 1);

  if (parentStock) {
    return {
      ownerType: "PRODUCT_PARENT" as const,
      ownerId: product.parent.id,
      ownerLabel: product.parent.sku,
      available: Number(product.parent.stockQuantity || 0),
      unitsPerSale,
      requiredUnits: positiveInt(orderQty, 1) * unitsPerSale,
    };
  }

  return {
    ownerType: "PRODUCT" as const,
    ownerId: product.id,
    ownerLabel: product.sku,
    available: Number(product.quantity || 0),
    unitsPerSale: 1,
    requiredUnits: positiveInt(orderQty, 1),
  };
}

export async function assertOrdersHaveStock(db: any, orderIds: string[]) {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const items = await db.orderItem.findMany({
    where: {
      orderId: { in: uniqueIds },
      stockDeductedAt: null,
    },
    include: {
      product: {
        include: { parent: true },
      },
    },
  });

  const requirements = new Map<
    string,
    {
      ownerType: "PRODUCT" | "PRODUCT_PARENT";
      ownerId: string;
      ownerLabel: string;
      available: number;
      required: number;
    }
  >();

  for (const item of items) {
    const product = await resolveProduct(db, item);
    const owner = ownerFor(product, item.quantity);
    const key = `${owner.ownerType}:${owner.ownerId}`;
    const current = requirements.get(key);

    if (current) {
      current.required += owner.requiredUnits;
    } else {
      requirements.set(key, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        ownerLabel: owner.ownerLabel,
        available: owner.available,
        required: owner.requiredUnits,
      });
    }
  }

  for (const row of requirements.values()) {
    if (row.available < row.required) {
      throw new InventoryError(
        `Insufficient stock for ${row.ownerLabel}. Required ${row.required}, available ${row.available}.`
      );
    }
  }
}

export async function deductOrderStock(
  tx: any,
  orderId: string,
  source: "CSV_BATCH" | "PUSH_ALL_COURIERS"
) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: {
      product: {
        include: { parent: true },
      },
    },
  });

  let deductedUnits = 0;

  for (const item of items) {
    if (item.stockDeductedAt) continue;

    const product = await resolveProduct(tx, item);
    const owner = ownerFor(product, item.quantity);
    const deductedAt = new Date();

    const claimed = await tx.orderItem.updateMany({
      where: {
        id: item.id,
        stockDeductedAt: null,
      },
      data: {
        stockDeductedAt: deductedAt,
        stockDeductionSource: source,
        stockOwnerType: owner.ownerType,
        stockOwnerId: owner.ownerId,
        stockUnitsPerSale: owner.unitsPerSale,
        stockDeductedUnits: owner.requiredUnits,
      },
    });

    if (claimed.count !== 1) continue;

    if (owner.ownerType === "PRODUCT_PARENT") {
      const updated = await tx.productParent.updateMany({
        where: {
          id: owner.ownerId,
          stockQuantity: { gte: owner.requiredUnits },
        },
        data: {
          stockQuantity: { decrement: owner.requiredUnits },
        },
      });

      if (updated.count !== 1) {
        throw new InventoryError(
          `Insufficient stock for ${owner.ownerLabel}. Required ${owner.requiredUnits}.`
        );
      }
    } else {
      const updated = await tx.product.updateMany({
        where: {
          id: owner.ownerId,
          quantity: { gte: owner.requiredUnits },
        },
        data: {
          quantity: { decrement: owner.requiredUnits },
        },
      });

      if (updated.count !== 1) {
        throw new InventoryError(
          `Insufficient stock for ${owner.ownerLabel}. Required ${owner.requiredUnits}.`
        );
      }
    }

    deductedUnits += owner.requiredUnits;
  }

  return { deductedUnits };
}

export async function restoreReturnedStock(
  tx: any,
  orderItemId: string,
  returnedOrderQty: number
) {
  const item = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      product: {
        include: { parent: true },
      },
    },
  });

  if (!item) {
    throw new InventoryError("Order item was not found.");
  }

  const product = await resolveProduct(tx, item);
  const fallbackOwner = ownerFor(product, item.quantity);
  const ownerType =
    item.stockOwnerType || fallbackOwner.ownerType;
  const ownerId = item.stockOwnerId || fallbackOwner.ownerId;
  const unitsPerSale = positiveInt(
    item.stockUnitsPerSale,
    fallbackOwner.unitsPerSale
  );

  const restoredUnits =
    item.stockDeductedAt && Number(item.stockDeductedUnits || 0) > 0
      ? ownerType === "PRODUCT_PARENT"
        ? positiveInt(returnedOrderQty, 1) * unitsPerSale
        : positiveInt(returnedOrderQty, 1)
      : 0;

  if (ownerType === "PRODUCT_PARENT") {
    const parent = await tx.productParent.findUnique({
      where: { id: ownerId },
      select: { stockQuantity: true },
    });

    if (!parent) {
      throw new InventoryError("Original parent stock owner was not found.");
    }

    const stockBefore = Number(parent.stockQuantity || 0);

    if (!restoredUnits) {
      return {
        productId: product.id,
        ownerType,
        restoredUnits: 0,
        stockBefore,
        stockAfter: stockBefore,
      };
    }

    const updated = await tx.productParent.update({
      where: { id: ownerId },
      data: {
        stockQuantity: { increment: restoredUnits },
      },
      select: { stockQuantity: true },
    });

    return {
      productId: product.id,
      ownerType,
      restoredUnits,
      stockBefore,
      stockAfter: Number(updated.stockQuantity || 0),
    };
  }

  const ownerProduct = await tx.product.findUnique({
    where: { id: ownerId },
    select: { quantity: true },
  });

  if (!ownerProduct) {
    throw new InventoryError("Original product stock owner was not found.");
  }

  const stockBefore = Number(ownerProduct.quantity || 0);

  if (!restoredUnits) {
    return {
      productId: product.id,
      ownerType,
      restoredUnits: 0,
      stockBefore,
      stockAfter: stockBefore,
    };
  }

  const updated = await tx.product.update({
    where: { id: ownerId },
    data: {
      quantity: { increment: restoredUnits },
    },
    select: { quantity: true },
  });

  return {
    productId: product.id,
    ownerType,
    restoredUnits,
    stockBefore,
    stockAfter: Number(updated.quantity || 0),
  };
}
