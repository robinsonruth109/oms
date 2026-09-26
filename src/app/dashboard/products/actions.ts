"use server";

import { parse } from "csv-parse/sync";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message: string;
};

function buildProductSlug(sku: string) {
  return sku.trim().toLowerCase();
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const numberValue = Math.floor(Number(value ?? fallback));
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function toPositiveInt(value: unknown, fallback = 1) {
  const numberValue = Math.floor(Number(value ?? fallback));
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function toMoney(value: unknown) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  const numberValue = Number(raw || 0);

  if (Number.isNaN(numberValue)) {
    return 0;
  }

  return numberValue;
}

async function ensureAdmin() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return session;
}

async function findOrCreateParent(
  tx: any,
  parentSku: string,
  parentName?: string,
  inventory?: {
    stockMode: "VARIANT_STOCK" | "PARENT_STOCK";
    stockQuantity: number;
    purchasePrice: number;
    updateExisting: boolean;
    // Only an explicitly confirmed physical count can overwrite stock.
    updateStock?: boolean;
    expectedStockQuantity?: number;
  }
) {
  const existingParent = await tx.productParent.findUnique({
    where: {
      sku: parentSku,
    },
  });

  if (existingParent) {
    if (!inventory?.updateExisting) return existingParent;

    if (inventory.updateStock) {
      const updated = await tx.productParent.updateMany({
        where: {
          id: existingParent.id,
          stockQuantity: inventory.expectedStockQuantity,
        },
        data: {
          stockQuantity: inventory.stockQuantity,
          stockVerifiedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          "Shared parent stock changed while you were editing. Reload and count it again."
        );
      }
    }

    return tx.productParent.update({
      where: { id: existingParent.id },
      data: {
        name: parentName?.trim() || existingParent.name,
        stockMode: inventory.stockMode,
        // Name/price edits must not write a stale quantity back to stock.
        // When switching stock owner mode, the new owner requires a count.
        stockVerifiedAt: inventory.updateStock
          ? undefined
          : existingParent.stockMode !== inventory.stockMode
            ? null
            : undefined,
        purchasePrice:
          inventory.stockMode === "PARENT_STOCK"
            ? inventory.purchasePrice
            : existingParent.purchasePrice,
      },
    });
  }

  return tx.productParent.create({
    data: {
      sku: parentSku,
      name: parentName?.trim() || parentSku,
      stockMode: inventory?.stockMode || "VARIANT_STOCK",
      stockQuantity: inventory?.updateStock ? inventory.stockQuantity : 0,
      // A freshly created manual physical count is verified; importer-created
      // placeholder stock stays unverified.
      stockVerifiedAt: inventory?.stockMode === "PARENT_STOCK" &&
        inventory.updateStock ? new Date() : null,
      purchasePrice:
        inventory?.stockMode === "PARENT_STOCK"
          ? inventory.purchasePrice
          : null,
      status: true,
    },
  });
}

export async function createProduct(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureAdmin();

    const parentSku = String(formData.get("parentSku") || "").trim();
    const parentName = String(formData.get("parentName") || "").trim();
    const sku = String(formData.get("sku") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const stockMode =
      String(formData.get("stockMode") || "VARIANT_STOCK") === "PARENT_STOCK"
        ? "PARENT_STOCK"
        : "VARIANT_STOCK";
    const quantity = toNonNegativeInt(formData.get("quantity"), 0);
    const unitsPerSale = toPositiveInt(formData.get("unitsPerSale"), 1);
    const parentStockQuantity = toNonNegativeInt(formData.get("parentStockQuantity"), 0);
    const parentPurchasePrice = toMoney(formData.get("parentPurchasePrice"));
    const purchasePrice = toMoney(formData.get("purchasePrice"));
    const sellingPrice = toMoney(formData.get("sellingPrice"));

    if (!parentSku || !sku) {
      return {
        success: false,
        message: "Parent SKU and SKU are required.",
      };
    }

    if (quantity < 0 || unitsPerSale <= 0 || parentStockQuantity < 0) {
      return {
        success: false,
        message: "Stock values cannot be negative and units per sale must be at least 1.",
      };
    }

    if (purchasePrice < 0 || sellingPrice < 0 || parentPurchasePrice < 0) {
      return {
        success: false,
        message: "Prices cannot be negative.",
      };
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        sku,
      },
    });

    if (existingProduct) {
      return {
        success: false,
        message: "This SKU already exists.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const parent = await findOrCreateParent(tx, parentSku, parentName, {
        stockMode,
        stockQuantity: parentStockQuantity,
        purchasePrice: parentPurchasePrice,
        updateExisting: false,
        updateStock: stockMode === "PARENT_STOCK",
      });

      await tx.product.create({
        data: {
          parentId: parent.id,
          sku,
          slug: buildProductSlug(sku),
          name: name || sku,
          quantity,
          // Explicit manual creation provides an initial physical count.
          stockVerifiedAt: stockMode === "VARIANT_STOCK" ? new Date() : null,
          unitsPerSale,
          purchasePrice,
          sellingPrice,
          status: true,
        },
      });
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      message:
        "Product created successfully. If parent SKU was missing, it was created automatically.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error && error.message === "Unauthorized"
          ? "Unauthorized action."
          : "Failed to create product.",
    };
  }
}

export async function updateProduct(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await ensureAdmin();

    const productId = String(formData.get("productId") || "").trim();
    const parentSku = String(formData.get("parentSku") || "").trim();
    const parentName = String(formData.get("parentName") || "").trim();
    const stockMode =
      String(formData.get("stockMode") || "VARIANT_STOCK") === "PARENT_STOCK"
        ? "PARENT_STOCK"
        : "VARIANT_STOCK";
    const quantity = toNonNegativeInt(formData.get("quantity"), 0);
    const unitsPerSale = toPositiveInt(formData.get("unitsPerSale"), 1);
    const parentStockQuantity = toNonNegativeInt(formData.get("parentStockQuantity"), 0);
    const parentPurchasePrice = toMoney(formData.get("parentPurchasePrice"));
    const sku = String(formData.get("sku") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const purchasePrice = toMoney(formData.get("purchasePrice"));
    const sellingPrice = toMoney(formData.get("sellingPrice"));
    const status = String(formData.get("status") || "").trim() === "true";
    const countConfirmed = formData.get("stockCountConfirmed") === "yes";
    const originalProductQty = Number(formData.get("originalProductQuantity"));
    const originalParentQty = Number(formData.get("originalParentStockQuantity"));

    if (!productId || !parentSku || !sku) {
      return {
        success: false,
        message: "Product ID, parent SKU and SKU are required.",
      };
    }
    if (quantity < 0 || unitsPerSale <= 0 || parentStockQuantity < 0) {
      return {
        success: false,
        message: "Stock values cannot be negative and units per sale must be at least 1.",
      };
    }

    if (purchasePrice < 0 || sellingPrice < 0 || parentPurchasePrice < 0) {
      return {
        success: false,
        message: "Prices cannot be negative.",
      };
    }

    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        parent: true,
        usedInBundles: { select: { id: true } },
      },
    });

    if (!currentProduct) {
      return {
        success: false,
        message: "Product not found.",
      };
    }
    if (countConfirmed && currentProduct.inventoryKind === "BUNDLE") {
      return {
        success: false,
        message: "You cannot count virtual bundle stock. Count each component SKU.",
      };
    }
    const enteredStockChanged = stockMode === "PARENT_STOCK"
      ? parentStockQuantity !== originalParentQty
      : quantity !== originalProductQty;
    if (enteredStockChanged && !countConfirmed) {
      return {
        success: false,
        message: "You changed a physical stock quantity. Tick the physical-count confirmation to verify it, or use Stock Adjustment.",
      };
    }
    if (countConfirmed && (
      !Number.isSafeInteger(originalProductQty) ||
      !Number.isSafeInteger(originalParentQty)
    )) {
      return {
        success: false,
        message: "Invalid original count. Reload the product and retry.",
      };
    }

    if (stockMode !== currentProduct.parent.stockMode) {
      const restrictedProductCount = await prisma.product.count({
        where: {
          parentId: currentProduct.parentId,
          OR: [
            { inventoryKind: "BUNDLE" },
            { usedInBundles: { some: {} } },
          ],
        },
      });
      if (restrictedProductCount > 0) {
        return {
          success: false,
          message: "Cannot change this parent stock mode while it contains virtual bundles or physical bundle components. Reconcile and detach recipes first.",
        };
      }
    }

    if (currentProduct.inventoryKind === "BUNDLE" &&
        (parentSku !== currentProduct.parent.sku ||
         stockMode !== currentProduct.parent.stockMode)) {
      return {
        success: false,
        message: "Bundle parent and stock mode cannot change. Edit the recipe instead.",
      };
    }
    if (currentProduct.usedInBundles.length &&
        (parentSku !== currentProduct.parent.sku ||
         stockMode !== currentProduct.parent.stockMode || !status)) {
      return {
        success: false,
        message: "This SKU is a physical bundle component. Keep its parent, mode and active status.",
      };
    }

    const duplicateProduct = await prisma.product.findFirst({
      where: {
        sku,
        NOT: {
          id: productId,
        },
      },
    });

    if (duplicateProduct) {
      return {
        success: false,
        message: "Another product already uses this SKU.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const previousParent = await tx.productParent.findUnique({
        where: { sku: parentSku },
      });
      const enteringParentCount = countConfirmed &&
        stockMode === "PARENT_STOCK";
      const enteringSkuCount = countConfirmed &&
        stockMode === "VARIANT_STOCK" &&
        currentProduct.inventoryKind === "PHYSICAL";

      const parent = await findOrCreateParent(tx, parentSku, parentName, {
        stockMode,
        stockQuantity: parentStockQuantity,
        purchasePrice: parentPurchasePrice,
        updateExisting: true,
        updateStock: enteringParentCount,
        expectedStockQuantity: originalParentQty,
      });

      if (previousParent && previousParent.stockMode !== stockMode) {
        await tx.product.updateMany({
          where: { parentId: previousParent.id },
          data: { stockVerifiedAt: null },
        });
      }

      if (enteringSkuCount) {
        const claimed = await tx.product.updateMany({
          where: { id: productId, quantity: originalProductQty },
          data: { quantity, stockVerifiedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new Error(
            "SKU stock changed while you were editing. Reload and count it again."
          );
        }
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          parentId: parent.id,
          sku,
          slug: buildProductSlug(sku),
          name: name || sku,
          // Never copy an unconfirmed, possibly stale stock quantity back
          // when Admin is changing only a price, name or status.
          stockVerifiedAt: enteringSkuCount
            ? undefined
            : stockMode !== "VARIANT_STOCK" ||
                currentProduct.parent.stockMode !== "VARIANT_STOCK"
              ? null
              : undefined,
          unitsPerSale: currentProduct.inventoryKind === "BUNDLE"
            ? currentProduct.unitsPerSale
            : unitsPerSale,
          purchasePrice,
          sellingPrice,
          status,
        },
      });

      const actorLabel = session.user.name || session.user.username || "OMS User";
      const actorId = session.user.id;

      if (enteringParentCount) {
        const before = previousParent?.stockQuantity || 0;
        const delta = parentStockQuantity - before;
        const cost = Number(parent.purchasePrice || 0);
        await tx.productStockAdjustment.create({
          data: {
            adjustmentDate: new Date(),
            adjustmentType: "SET_COUNT",
            productId: currentProduct.id,
            parentId: parent.id,
            skuSnapshot: sku,
            productNameSnapshot: name || sku,
            parentSkuSnapshot: parent.sku,
            stockOwnerType: "PRODUCT_PARENT",
            stockOwnerId: parent.id,
            enteredQuantity: parentStockQuantity,
            unitsPerSale: 1,
            adjustedStockUnits: Math.abs(delta),
            unitCost: cost,
            adjustmentValue: Math.abs(delta) * cost,
            stockBefore: before,
            stockAfter: parentStockQuantity,
            reason: "Product Master Physical Count",
            note: "Exact physical parent count confirmed in Product Master.",
            createdByUserId: actorId,
            createdByName: actorLabel,
          },
        });
      }

      if (enteringSkuCount) {
        const delta = quantity - originalProductQty;
        await tx.productStockAdjustment.create({
          data: {
            adjustmentDate: new Date(),
            adjustmentType: "SET_COUNT",
            productId: currentProduct.id,
            parentId: parent.id,
            skuSnapshot: sku,
            productNameSnapshot: name || sku,
            parentSkuSnapshot: parent.sku,
            stockOwnerType: "PRODUCT",
            stockOwnerId: currentProduct.id,
            enteredQuantity: quantity,
            unitsPerSale: 1,
            adjustedStockUnits: Math.abs(delta),
            unitCost: purchasePrice,
            adjustmentValue: Math.abs(delta) * purchasePrice,
            stockBefore: originalProductQty,
            stockAfter: quantity,
            reason: "Product Master Physical Count",
            note: "Exact physical SKU count confirmed in Product Master.",
            createdByUserId: actorId,
            createdByName: actorLabel,
          },
        });
      }
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      message: countConfirmed
        ? "Product updated and physical stock counted. This stock is now included in valuation."
        : "Product updated. Legacy stock remains excluded from valuation until physically counted.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error && error.message === "Unauthorized"
          ? "Unauthorized action."
          : "Failed to update product.",
    };
  }
}

export async function importProductsCsv(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await ensureAdmin();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return {
        success: false,
        message: "Please upload a CSV file.",
      };
    }

    const content = await file.text();

    if (!content.trim()) {
      return {
        success: false,
        message: "CSV file is empty.",
      };
    }

    const rows = parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    if (!rows.length) {
      return {
        success: false,
        message: "No rows found in CSV.",
      };
    }

    let startIndex = 0;
    let skuIndex = 0;
    let purchaseIndex = 1;
    let sellIndex = 2;
    let parentIndex = 3;
    let quantityIndex = 4;

    const firstRow = rows[0].map((cell) => String(cell || "").trim().toLowerCase());

    const hasHeader =
      firstRow.some((cell) => cell.includes("sku")) ||
      firstRow.some((cell) => cell.includes("purchase")) ||
      firstRow.some((cell) => cell.includes("sell")) ||
      firstRow.some((cell) => cell.includes("parent"));

    if (hasHeader) {
      startIndex = 1;
      const foundSku = firstRow.findIndex((cell) => cell.includes("sku"));
      const foundQuantity = firstRow.findIndex((cell) => cell.includes("qty") || cell.includes("quantity"));
      const foundPurchase = firstRow.findIndex((cell) => cell.includes("purchase"));
      const foundSell = firstRow.findIndex((cell) => cell.includes("sell"));
      const foundParent = firstRow.findIndex((cell) => cell.includes("parent"));

      if (foundSku >= 0) skuIndex = foundSku;
      if (foundPurchase >= 0) purchaseIndex = foundPurchase;
      if (foundSell >= 0) sellIndex = foundSell;
      if (foundParent >= 0) parentIndex = foundParent;
      if (foundQuantity >= 0) quantityIndex = foundQuantity;
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (let i = startIndex; i < rows.length; i += 1) {
        const row = rows[i] || [];

        const sku = String(row[skuIndex] || "").trim();
        const purchasePrice = toMoney(row[purchaseIndex]);
        const sellingPrice = toMoney(row[sellIndex]);
        const quantity = Number(row[quantityIndex] || 1);
        const parentSku = String(row[parentIndex] || "").trim();

        if (!sku) {
          skippedCount += 1;
          continue;
        }

        const finalParentSku = parentSku || sku;

        const parent = await findOrCreateParent(tx, finalParentSku, finalParentSku);

        const existingProduct = await tx.product.findUnique({
          where: {
            sku,
          },
        });

        if (existingProduct) {
          // CSV must never recreate stock for a virtual selling bundle.
          if (existingProduct.inventoryKind === "BUNDLE") {
            skippedCount += 1;
            continue;
          }
          const usedBy = await tx.productBundleComponent.count({
            where: { componentProductId: existingProduct.id },
          });
          if (usedBy && existingProduct.parentId !== parent.id) {
            skippedCount += 1;
            continue;
          }
          // CSV imports never verify legacy stock and must never overwrite
          // a balance that someone has already counted manually.
          const importedReferenceQty = quantity > 0 ? quantity : 1;
          const existingQty = existingProduct.stockVerifiedAt
            ? existingProduct.quantity
            : importedReferenceQty;
          await tx.product.update({
            where: {
              sku,
            },
            data: {
              parentId: parent.id,
              slug: buildProductSlug(sku),
              name: existingProduct.name || sku,
              purchasePrice,
              sellingPrice,
              quantity: existingQty,
              status: true,
            },
          });

          updatedCount += 1;
        } else {
          await tx.product.create({
            data: {
              parentId: parent.id,
              sku,
              slug: buildProductSlug(sku),
              name: sku,
              purchasePrice,
              sellingPrice,
              quantity: quantity > 0 ? quantity : 1,
              status: true,
            },
          });

          importedCount += 1;
        }
      }
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stock-valuation");

    return {
      success: true,
      message: `CSV import complete. Created: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}. Imported quantities are unverified; already verified physical stock counts are preserved.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error && error.message === "Unauthorized"
          ? "Unauthorized action."
          : "Failed to import CSV.",
    };
  }
}