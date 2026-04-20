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
  parentName?: string
) {
  const existingParent = await tx.productParent.findUnique({
    where: {
      sku: parentSku,
    },
  });

  if (existingParent) {
    return existingParent;
  }

  return tx.productParent.create({
    data: {
      sku: parentSku,
      name: parentName?.trim() || parentSku,
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
    const purchasePrice = toMoney(formData.get("purchasePrice"));
    const sellingPrice = toMoney(formData.get("sellingPrice"));

    if (!parentSku || !sku) {
      return {
        success: false,
        message: "Parent SKU and SKU are required.",
      };
    }

    if (purchasePrice < 0 || sellingPrice < 0) {
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
      const parent = await findOrCreateParent(tx, parentSku, parentName);

      await tx.product.create({
        data: {
          parentId: parent.id,
          sku,
          name: name || sku,
          purchasePrice,
          sellingPrice,
          status: true,
        },
      });
    });

    revalidatePath("/dashboard/products");

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
    await ensureAdmin();

    const productId = String(formData.get("productId") || "").trim();
    const parentSku = String(formData.get("parentSku") || "").trim();
    const parentName = String(formData.get("parentName") || "").trim();
    const sku = String(formData.get("sku") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const purchasePrice = toMoney(formData.get("purchasePrice"));
    const sellingPrice = toMoney(formData.get("sellingPrice"));
    const status = String(formData.get("status") || "").trim() === "true";

    if (!productId || !parentSku || !sku) {
      return {
        success: false,
        message: "Product ID, parent SKU and SKU are required.",
      };
    }

    const currentProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!currentProduct) {
      return {
        success: false,
        message: "Product not found.",
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
      const parent = await findOrCreateParent(tx, parentSku, parentName);

      await tx.product.update({
        where: {
          id: productId,
        },
        data: {
          parentId: parent.id,
          sku,
          name: name || sku,
          purchasePrice,
          sellingPrice,
          status,
        },
      });
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Product updated successfully.",
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

    const firstRow = rows[0].map((cell) => String(cell || "").trim().toLowerCase());

    const hasHeader =
      firstRow.some((cell) => cell.includes("sku")) ||
      firstRow.some((cell) => cell.includes("purchase")) ||
      firstRow.some((cell) => cell.includes("sell")) ||
      firstRow.some((cell) => cell.includes("parent"));

    if (hasHeader) {
      startIndex = 1;
      const foundSku = firstRow.findIndex((cell) => cell.includes("sku"));
      const foundPurchase = firstRow.findIndex((cell) => cell.includes("purchase"));
      const foundSell = firstRow.findIndex((cell) => cell.includes("sell"));
      const foundParent = firstRow.findIndex((cell) => cell.includes("parent"));

      if (foundSku >= 0) skuIndex = foundSku;
      if (foundPurchase >= 0) purchaseIndex = foundPurchase;
      if (foundSell >= 0) sellIndex = foundSell;
      if (foundParent >= 0) parentIndex = foundParent;
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
          await tx.product.update({
            where: {
              sku,
            },
            data: {
              parentId: parent.id,
              name: existingProduct.name || sku,
              purchasePrice,
              sellingPrice,
              status: true,
            },
          });

          updatedCount += 1;
        } else {
          await tx.product.create({
            data: {
              parentId: parent.id,
              sku,
              name: sku,
              purchasePrice,
              sellingPrice,
              status: true,
            },
          });

          importedCount += 1;
        }
      }
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `CSV import complete. Created: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}.`,
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