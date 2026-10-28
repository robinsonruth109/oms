import "server-only";

import { findProductByFlexibleSku } from "@/lib/product-sku-match";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}
function positiveInt(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function queueWebsiteStockSync(
  tx: any,
  owners: Array<{
    ownerType: "PRODUCT" | "PRODUCT_PARENT";
    ownerId: string;
  }>
) {
  if (!owners.length) return;

  // Catalog publishing must never make physical stock transactions fail.
  // Use a dynamic import to avoid a module cycle: the catalog worker uses the
  // inventory resolver to calculate website-visible quantities.
  try {
    const { enqueueStockSyncForOwners } = await import(
      "@/lib/product-catalog-sync"
    );
    await enqueueStockSyncForOwners(tx, owners);
  } catch (error) {
    console.error("[ProductCatalog] Could not queue stock sync:", error);
  }
}
export type PhysicalRequirement = {
  ownerType: "PRODUCT" | "PRODUCT_PARENT";
  ownerId: string;
  ownerLabel: string;
  available: number;
  unitsPerSale: number;
  requiredUnits: number;
  unitCost: number;
};
export type InventoryStockWarning = {
  ownerType: "PRODUCT" | "PRODUCT_PARENT";
  ownerId: string;
  ownerLabel: string;
  available: number;
  required: number;
  resultingStock: number;
};
async function resolveProduct(db: any, item: any) {
  if (item.product?.parent) return item.product;

  const match = await findProductByFlexibleSku(db, item.productSku);

  if (match.matchedBy === "AMBIGUOUS") {
    throw new InventoryError(
      "Product " +
        item.productSku +
        " matches more than one Product Master SKU after spacing normalization: " +
        match.candidates.join(", ") +
        ". Please correct the order item manually."
    );
  }

  let product = match.product;

  // Historical Shopify orders may contain a generated placeholder SKU such as
  // SHOPIFY-9804907741467 instead of the Product Master SKU. If that website
  // product has since been connected in Catalog Import Hub / Website Listing,
  // recover the exact OMS variation from the saved integration mapping.
  if (!product) {
    const rawSku = String(item.productSku || "").trim();
    const legacyRemoteIdMatch = rawSku.match(/^SHOPIFY-(.+)$/i);
    const integrationId = item.order?.integrationId || null;
    const remoteProductId = legacyRemoteIdMatch?.[1]?.trim() || "";

    if (integrationId && remoteProductId) {
      const listing = await db.productWebsiteListing.findFirst({
        where: {
          integrationId,
          remoteProductId,
        },
        include: {
          product: {
            include: { parent: true },
          },
        },
      });

      if (listing?.product) {
        product = listing.product;
      } else {
        const candidate = await db.productCatalogImportCandidate.findFirst({
          where: {
            integrationId,
            remoteProductId,
            matchedProductId: { not: null },
          },
          include: {
            matchedProduct: {
              include: { parent: true },
            },
          },
        });

        if (candidate?.matchedProduct) {
          product = candidate.matchedProduct;
        }
      }
    }
  }

  if (!product) {
    throw new InventoryError(
      "Product " + item.productSku + " is not linked to Product Master."
    );
  }

  // Repair historical/imported items once an exact/normalized/catalog mapping
  // is proven. From this point forward the order item behaves like a native OMS
  // Product Master item and normal stock rules apply.
  if (
    item.id &&
    (!item.productId ||
      item.productId !== product.id ||
      item.productSku !== product.sku)
  ) {
    await db.orderItem.update({
      where: { id: item.id },
      data: {
        productId: product.id,
        productSku: product.sku,
      },
    });
  }

  return product;
}
function ownerFor(product: any, qty: number): PhysicalRequirement {
  if (product.inventoryKind === "BUNDLE") {
    throw new InventoryError("Bundle " + product.sku + " has no physical stock owner.");
  }

  // Merchant-owned parents can contain stock already purchased by OMS.
  // That reserve stays in the same physical Product Master bucket, but normal
  // merchant sales must not consume it. Existing OMS-owned products have
  // merchantId = null, so their available stock is unchanged.
  const merchantOwned = Boolean(product.parent?.merchantId);

  if (product.parent.stockMode === "PARENT_STOCK") {
    const factor = positiveInt(product.unitsPerSale);
    const physical = Number(product.parent.stockQuantity || 0);
    const omsReserve = merchantOwned
      ? Number(product.parent.omsOwnedStockQuantity || 0)
      : 0;
    return {
      ownerType: "PRODUCT_PARENT",
      ownerId: product.parent.id,
      ownerLabel: product.parent.sku,
      available: Math.max(0, physical - omsReserve),
      unitsPerSale: factor,
      requiredUnits: qty * factor,
      unitCost: Number(product.parent.purchasePrice || 0),
    };
  }

  const physical = Number(product.quantity || 0);
  const omsReserve = merchantOwned
    ? Number(product.omsOwnedStockQuantity || 0)
    : 0;

  return {
    ownerType: "PRODUCT",
    ownerId: product.id,
    ownerLabel: product.sku,
    available: Math.max(0, physical - omsReserve),
    unitsPerSale: 1,
    requiredUnits: qty,
    unitCost: Number(product.purchasePrice || 0),
  };
}
/** One selling SKU may consume multiple physical owners. Never allow nested bundles. */
export async function resolvePhysicalRequirements(
  db: any, product: any, saleQty: number
): Promise<PhysicalRequirement[]> {
  const qty = positiveInt(saleQty);
  if (product.inventoryKind !== "BUNDLE") return [ownerFor(product, qty)];
  const recipe = await db.productBundleComponent.findMany({
    where: { bundleProductId: product.id },
    include: { componentProduct: { include: { parent: true } } },
  });
  if (!recipe.length) throw new InventoryError("Bundle " + product.sku + " has no component recipe.");
  const grouped = new Map<string, PhysicalRequirement>();
  for (const part of recipe) {
    const component = part.componentProduct;
    if (!component?.status || component.inventoryKind !== "PHYSICAL") {
      throw new InventoryError("Bundle " + product.sku + " has an inactive/non-physical component.");
    }
    const units = positiveInt(part.units, 0);
    if (!units) throw new InventoryError("Bundle " + product.sku + " has an invalid component quantity.");
    const row = ownerFor(component, qty * units);
    const key = row.ownerType + ":" + row.ownerId;
    const existing = grouped.get(key);
    if (existing) {
      existing.unitsPerSale += row.unitsPerSale * units;
      existing.requiredUnits += row.requiredUnits;
    } else {
      grouped.set(key, {
        ...row,
        unitsPerSale: row.unitsPerSale * units,
      });
    }
  }
  return [...grouped.values()];
}
export async function availableBundleSets(db: any, product: any) {
  const parts = await resolvePhysicalRequirements(db, product, 1);
  return Math.max(0, Math.min(...parts.map((row) =>
    Math.floor(row.available / row.requiredUnits)
  )));
}
export async function getOrderStockWarnings(
  db: any, orderIds: string[]
): Promise<InventoryStockWarning[]> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return [];
  const items = await db.orderItem.findMany({
    where: { orderId: { in: ids }, stockDeductedAt: null },
    include: {
      product: { include: { parent: true } },
      order: { select: { integrationId: true } },
    },
  });
  const totals = new Map<string, {
    ownerType: "PRODUCT" | "PRODUCT_PARENT";
    ownerId: string;
    ownerLabel: string;
    available: number;
    required: number;
  }>();
  for (const item of items) {
    const product = await resolveProduct(db, item);
    for (const owner of await resolvePhysicalRequirements(db, product, item.quantity)) {
      const key = owner.ownerType + ":" + owner.ownerId;
      const current = totals.get(key);
      if (current) current.required += owner.requiredUnits;
      else totals.set(key, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        ownerLabel: owner.ownerLabel,
        available: owner.available,
        required: owner.requiredUnits,
      });
    }
  }
  return [...totals.values()]
    .filter((row) => row.available < row.required)
    .map((row) => ({ ...row, resultingStock: row.available - row.required }));
}
/** Courier acceptance transaction: claim once, snapshot every owner, allow negative stock. */
export async function deductOrderStock(
  tx: any, orderId: string, source: "CSV_BATCH" | "PUSH_ALL_COURIERS"
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { pathaoCourierId: true },
  });

  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: {
      product: { include: { parent: true } },
      order: { select: { integrationId: true } },
    },
  });

  const merchantIds = order?.pathaoCourierId
    ? (
        await tx.merchantCourier.findMany({
          where: { courierId: order.pathaoCourierId },
          select: { merchantId: true },
        })
      ).map((row: any) => row.merchantId)
    : [];

  let deductedUnits = 0;
  const affectedOwners: Array<{
    ownerType: "PRODUCT" | "PRODUCT_PARENT";
    ownerId: string;
  }> = [];

  for (const item of items) {
    if (item.stockDeductedAt) continue;

    const product = await resolveProduct(tx, item);
    const owners = await resolvePhysicalRequirements(tx, product, item.quantity);

    // New Merchant flow:
    // OMS stock is already reduced when Admin allocates stock to a Merchant.
    // Therefore a parcel sent through a courier assigned to that Merchant must
    // consume MerchantStockAllocation, not Product Master a second time.
    let merchantId: string | null = null;
    let merchantAllocationRows: any[] = [];

    if (merchantIds.length && product.inventoryKind !== "BUNDLE") {
      const candidates = await tx.merchantStockAllocation.findMany({
        where: {
          merchantId: { in: merchantIds },
          productId: product.id,
          remainingPhysicalUnits: { gt: 0 },
        },
        orderBy: [{ allocationDate: "asc" }, { createdAt: "asc" }],
      });

      const candidateMerchantIds = Array.from(
        new Set(candidates.map((row: any) => row.merchantId))
      );

      if (candidateMerchantIds.length === 1) {
        merchantId = String(candidateMerchantIds[0]);
        merchantAllocationRows = candidates.filter(
          (row: any) => row.merchantId === merchantId
        );
      }
    }

    if (merchantId && merchantAllocationRows.length && owners.length === 1) {
      const requiredUnits = owners[0].requiredUnits;
      const availableUnits = merchantAllocationRows.reduce(
        (sum: number, row: any) =>
          sum + Math.max(0, Number(row.remainingPhysicalUnits || 0)),
        0
      );

      if (availableUnits < requiredUnits) {
        throw new InventoryError(
          "Merchant allocated stock is insufficient for " +
            product.sku +
            ". Required " +
            requiredUnits +
            " physical unit(s), available " +
            availableUnits +
            ". Allocate more stock to the Merchant before courier submission."
        );
      }

      const claimed = await tx.orderItem.updateMany({
        where: { id: item.id, stockDeductedAt: null },
        data: {
          stockDeductedAt: new Date(),
          stockDeductionSource: "MERCHANT_ALLOCATION",
          stockOwnerType: null,
          stockOwnerId: merchantId,
          stockUnitsPerSale: owners[0].unitsPerSale,
          stockDeductedUnits: requiredUnits,
        },
      });
      if (claimed.count !== 1) continue;

      let remainingToConsume = requiredUnits;

      for (const allocation of merchantAllocationRows) {
        if (remainingToConsume <= 0) break;
        const available = Math.max(
          0,
          Number(allocation.remainingPhysicalUnits || 0)
        );
        if (!available) continue;

        const consume = Math.min(available, remainingToConsume);

        await tx.merchantStockAllocation.update({
          where: { id: allocation.id },
          data: { remainingPhysicalUnits: { decrement: consume } },
        });

        // Reuse the existing immutable order-item stock snapshot table. For
        // MERCHANT_ALLOCATION rows ownerId is the MerchantStockAllocation id;
        // restoreReturnedStock handles these rows separately and never touches
        // Product Master.
        await tx.orderItemStockAllocation.create({
          data: {
            orderItemId: item.id,
            ownerType: "PRODUCT",
            ownerId: allocation.id,
            ownerSkuSnapshot:
              product.sku + " · Merchant receipt " + allocation.receiptNo,
            unitsPerSale: 1,
            deductedUnits: consume,
          },
        });

        remainingToConsume -= consume;
        deductedUnits += consume;
      }

      continue;
    }

    // Normal OMS-owned stock path.
    const claimed = await tx.orderItem.updateMany({
      where: { id: item.id, stockDeductedAt: null },
      data: {
        stockDeductedAt: new Date(),
        stockDeductionSource: source,
        stockOwnerType: owners.length === 1 ? owners[0].ownerType : null,
        stockOwnerId: owners.length === 1 ? owners[0].ownerId : null,
        stockUnitsPerSale: owners.length === 1 ? owners[0].unitsPerSale : null,
        stockDeductedUnits: owners.reduce((sum, row) => sum + row.requiredUnits, 0),
      },
    });
    if (claimed.count !== 1) continue;

    for (const row of owners) {
      await tx.orderItemStockAllocation.create({
        data: {
          orderItemId: item.id,
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          ownerSkuSnapshot: row.ownerLabel,
          unitsPerSale: row.unitsPerSale,
          deductedUnits: row.requiredUnits,
        },
      });

      if (row.ownerType === "PRODUCT_PARENT") {
        await tx.productParent.update({
          where: { id: row.ownerId },
          data: { stockQuantity: { decrement: row.requiredUnits } },
        });
      } else {
        await tx.product.update({
          where: { id: row.ownerId },
          data: { quantity: { decrement: row.requiredUnits } },
        });
      }

      deductedUnits += row.requiredUnits;
      affectedOwners.push({
        ownerType: row.ownerType,
        ownerId: row.ownerId,
      });
    }
  }

  await queueWebsiteStockSync(tx, affectedOwners);
  return { deductedUnits };
}
/** Always restore from original allocation snapshots (not today's editable recipe). */
export async function restoreReturnedStock(
  tx: any, orderItemId: string, returnedOrderQty: number
) {
  const item = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      product: { include: { parent: true } },
      order: { select: {
        integrationId: true,
        csvDownloaded: true,
        pathaoSubmissionStatus: true,
        pathaoConsignmentId: true,
        pathaoSubmittedAt: true,
      } },
      stockAllocations: true,
    },
  });
  if (!item) throw new InventoryError("Order item was not found.");
  const product = await resolveProduct(tx, item);
  const qty = positiveInt(returnedOrderQty, 0);
  if (!qty) throw new InventoryError("Returned quantity must be positive.");

  if (
    item.stockDeductionSource === "MERCHANT_ALLOCATION" &&
    item.stockOwnerId &&
    item.stockAllocations.length
  ) {
    let restoredUnits = 0;
    const breakdown: Array<{
      ownerSku: string;
      ownerType: string;
      quantity: number;
      before: number;
      after: number;
    }> = [];

    let requestedUnits = qty * positiveInt(item.stockUnitsPerSale, 1);

    for (const allocation of item.stockAllocations) {
      if (requestedUnits <= 0) break;

      const remainingOriginal =
        Number(allocation.deductedUnits || 0) -
        Number(allocation.restoredUnits || 0);
      const units = Math.min(requestedUnits, Math.max(0, remainingOriginal));
      if (!units) continue;

      const claim = await tx.orderItemStockAllocation.updateMany({
        where: {
          id: allocation.id,
          restoredUnits: { lte: allocation.deductedUnits - units },
        },
        data: { restoredUnits: { increment: units } },
      });
      if (claim.count !== 1) {
        throw new InventoryError(
          "Merchant stock for this return has already been restored."
        );
      }

      const merchantAllocation = await tx.merchantStockAllocation.findUnique({
        where: { id: allocation.ownerId },
        select: {
          id: true,
          receiptNo: true,
          merchantId: true,
          remainingPhysicalUnits: true,
        },
      });

      if (
        !merchantAllocation ||
        merchantAllocation.merchantId !== item.stockOwnerId
      ) {
        throw new InventoryError(
          "Original Merchant allocation record is missing."
        );
      }

      const before = Number(merchantAllocation.remainingPhysicalUnits || 0);
      const updated = await tx.merchantStockAllocation.update({
        where: { id: merchantAllocation.id },
        data: { remainingPhysicalUnits: { increment: units } },
        select: { remainingPhysicalUnits: true },
      });
      const after = Number(updated.remainingPhysicalUnits || 0);

      restoredUnits += units;
      requestedUnits -= units;
      breakdown.push({
        ownerSku: merchantAllocation.receiptNo,
        ownerType: "MERCHANT_ALLOCATION",
        quantity: units,
        before,
        after,
      });
    }

    if (requestedUnits > 0) {
      throw new InventoryError(
        "Return exceeds the Merchant stock originally deducted for this order."
      );
    }

    return {
      productId: product.id,
      ownerType: "MERCHANT_ALLOCATION",
      restoredUnits,
      stockBefore: breakdown.length === 1 ? breakdown[0].before : 0,
      stockAfter: breakdown.length === 1 ? breakdown[0].after : 0,
      stockBreakdown: breakdown,
      usedLegacyFallback: false,
    };
  }

  if (item.stockAllocations.length) {
    let restoredUnits = 0;
    const breakdown: Array<{
      ownerSku: string;
      ownerType: string;
      quantity: number;
      before: number;
      after: number;
    }> = [];
    for (const allocation of item.stockAllocations) {
      const units = qty * positiveInt(allocation.unitsPerSale);
      const remaining = allocation.deductedUnits - allocation.restoredUnits;
      if (units > remaining) {
        throw new InventoryError("Return exceeds stock originally deducted for " + allocation.ownerSkuSnapshot);
      }
      const claim = await tx.orderItemStockAllocation.updateMany({
        where: {
          id: allocation.id,
          restoredUnits: { lte: allocation.deductedUnits - units },
        },
        data: { restoredUnits: { increment: units } },
      });
      if (claim.count !== 1) {
        throw new InventoryError("Stock for this return has already been restored.");
      }
      let before = 0;
      let after = 0;
      if (allocation.ownerType === "PRODUCT_PARENT") {
        const owner = await tx.productParent.findUnique({
          where: { id: allocation.ownerId }, select: { stockQuantity: true },
        });
        if (!owner) throw new InventoryError("Original parent owner missing.");
        before = owner.stockQuantity;
        const updated = await tx.productParent.update({
          where: { id: allocation.ownerId },
          data: { stockQuantity: { increment: units } },
          select: { stockQuantity: true },
        });
        after = updated.stockQuantity;
      } else {
        const owner = await tx.product.findUnique({
          where: { id: allocation.ownerId }, select: { quantity: true },
        });
        if (!owner) throw new InventoryError("Original product owner missing.");
        before = owner.quantity;
        const updated = await tx.product.update({
          where: { id: allocation.ownerId },
          data: { quantity: { increment: units } },
          select: { quantity: true },
        });
        after = updated.quantity;
      }
      restoredUnits += units;
      breakdown.push({
        ownerSku: allocation.ownerSkuSnapshot,
        ownerType: allocation.ownerType,
        quantity: units,
        before, after,
      });
    }
    await queueWebsiteStockSync(
      tx,
      item.stockAllocations.map((allocation: any) => ({
        ownerType: allocation.ownerType,
        ownerId: allocation.ownerId,
      }))
    );

    return {
      productId: product.id,
      ownerType: breakdown.length === 1 ? item.stockAllocations[0].ownerType : "BUNDLE",
      restoredUnits,
      stockBefore: breakdown.length === 1 ? breakdown[0].before : 0,
      stockAfter: breakdown.length === 1 ? breakdown[0].after : 0,
      stockBreakdown: breakdown,
      usedLegacyFallback: false,
    };
  }
  // Older shipments may lack allocations. Use the OLD recorded owner if
  // available. Never invent a multicomponent history from a changed recipe.
  if (product.inventoryKind === "BUNDLE" && !item.stockOwnerId) {
    throw new InventoryError(
      "Legacy bundle has no original stock-owner record: reconcile the physical component SKUs manually."
    );
  }
  const fallback = product.inventoryKind === "BUNDLE"
    ? null : ownerFor(product, item.quantity);
  const ownerType = item.stockOwnerType || fallback?.ownerType;
  const ownerId = item.stockOwnerId || fallback?.ownerId;
  const factor = positiveInt(item.stockUnitsPerSale, fallback?.unitsPerSale || 1);
  if (!ownerType || !ownerId) {
    throw new InventoryError("Original stock owner not found.");
  }
  const tracked = Boolean(item.stockDeductedAt) && item.stockDeductedUnits > 0;
  const legacy = !tracked && Boolean(
    item.order?.csvDownloaded ||
    item.order?.pathaoConsignmentId ||
    item.order?.pathaoSubmittedAt ||
    (item.order?.pathaoSubmissionStatus &&
     item.order.pathaoSubmissionStatus !== "NOT_SUBMITTED")
  );
  const restoredUnits = tracked || legacy
    ? qty * (ownerType === "PRODUCT_PARENT" ? factor : 1) : 0;
  if (ownerType === "PRODUCT_PARENT") {
    const beforeRow = await tx.productParent.findUnique({
      where: { id: ownerId }, select: { stockQuantity: true, sku: true },
    });
    if (!beforeRow) throw new InventoryError("Original parent owner missing.");
    const before = beforeRow.stockQuantity;
    const afterRow = restoredUnits
      ? await tx.productParent.update({
          where: { id: ownerId },
          data: { stockQuantity: { increment: restoredUnits } },
          select: { stockQuantity: true },
        })
      : beforeRow;
    await queueWebsiteStockSync(tx, [
      { ownerType: "PRODUCT_PARENT", ownerId },
    ]);

    return {
      productId: product.id,
      ownerType,
      restoredUnits,
      stockBefore: before,
      stockAfter: afterRow.stockQuantity,
      stockBreakdown: [{ ownerSku: beforeRow.sku, ownerType,
        quantity: restoredUnits, before, after: afterRow.stockQuantity }],
      usedLegacyFallback: legacy,
    };
  }
  const beforeRow = await tx.product.findUnique({
    where: { id: ownerId }, select: { quantity: true, sku: true },
  });
  if (!beforeRow) throw new InventoryError("Original product owner missing.");
  const before = beforeRow.quantity;
  const afterRow = restoredUnits
    ? await tx.product.update({
        where: { id: ownerId },
        data: { quantity: { increment: restoredUnits } },
        select: { quantity: true },
      })
    : beforeRow;
  await queueWebsiteStockSync(tx, [
    { ownerType: "PRODUCT", ownerId },
  ]);

  return {
    productId: product.id,
    ownerType,
    restoredUnits,
    stockBefore: before,
    stockAfter: afterRow.quantity,
    stockBreakdown: [{ ownerSku: beforeRow.sku, ownerType,
      quantity: restoredUnits, before, after: afterRow.quantity }],
    usedLegacyFallback: legacy,
  };
}
