"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueStockSyncForOwners } from "@/lib/product-catalog-sync";

export type MerchantActionResult = {
  success: boolean;
  message: string;
  username?: string;
  temporaryPassword?: string;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized action.");
  }
  return session;
}

function cleanPhone(value: unknown) {
  return String(value || "").replace(/[^0-9+]/g, "").trim();
}

function positiveNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function positiveInt(value: unknown) {
  const n = Math.floor(Number(value || 0));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function refreshMerchantPages() {
  revalidatePath("/dashboard/merchant-control");
  revalidatePath("/dashboard/merchant");
  revalidatePath("/dashboard/merchant/products");
  revalidatePath("/dashboard/merchant/purchases");
  revalidatePath("/dashboard/merchant/profit-loss");
  revalidatePath("/dashboard/merchant/dollar-wallet");
  revalidatePath("/dashboard/ads-cost/sync");
  revalidatePath("/dashboard/ads-cost/report");
  revalidatePath("/dashboard/products-purchases/purchase-orders");
  revalidatePath("/dashboard/products-purchases/received-orders");
}

export async function createMerchant(input: {
  name: string;
  phone: string;
  address: string;
}): Promise<MerchantActionResult> {
  try {
    await requireAdmin();

    const name = String(input.name || "").trim();
    const phone = cleanPhone(input.phone);
    const address = String(input.address || "").trim();

    if (!name || !phone || !address) {
      return { success: false, message: "Name, phone number and address are required." };
    }

    const username = phone.replace(/\D/g, "") || phone;
    if (username.length < 6) {
      return { success: false, message: "Phone number is too short for Merchant login." };
    }

    const [phoneExists, usernameExists] = await Promise.all([
      prisma.merchant.findUnique({ where: { phone }, select: { id: true } }),
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
    ]);

    if (phoneExists) {
      return { success: false, message: "A Merchant with this phone number already exists." };
    }
    if (usernameExists) {
      return {
        success: false,
        message: "This phone number is already used as an OMS login. Use another phone number.",
      };
    }

    const temporaryPassword = randomBytes(7).toString("base64url");
    const password = await bcrypt.hash(temporaryPassword, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          username,
          password,
          role: "MERCHANT",
          status: true,
        },
      });

      await tx.merchant.create({
        data: {
          name,
          phone,
          address,
          userId: user.id,
          status: true,
        },
      });
    });

    refreshMerchantPages();

    return {
      success: true,
      message: "Merchant created successfully. Save the temporary login password now.",
      username,
      temporaryPassword,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create Merchant.",
    };
  }
}

export async function updateMerchant(input: {
  merchantId: string;
  name: string;
  phone: string;
  address: string;
  newPassword?: string;
}): Promise<MerchantActionResult> {
  try {
    await requireAdmin();

    const merchantId = String(input.merchantId || "").trim();
    const name = String(input.name || "").trim();
    const phone = cleanPhone(input.phone);
    const address = String(input.address || "").trim();
    const newPassword = String(input.newPassword || "");

    if (!merchantId || !name || !phone || !address) {
      return {
        success: false,
        message: "Merchant, name, phone number and address are required.",
      };
    }

    if (newPassword && newPassword.length < 8) {
      return {
        success: false,
        message: "New password must be at least 8 characters.",
      };
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        phone: true,
        userId: true,
        user: {
          select: {
            id: true,
            role: true,
            username: true,
          },
        },
      },
    });

    if (!merchant) {
      return { success: false, message: "Merchant not found." };
    }

    if (!merchant.userId || !merchant.user || merchant.user.role !== "MERCHANT") {
      return {
        success: false,
        message: "Merchant login account is missing or invalid.",
      };
    }

    const phoneExists = await prisma.merchant.findFirst({
      where: {
        phone,
        id: { not: merchantId },
      },
      select: { id: true },
    });

    if (phoneExists) {
      return {
        success: false,
        message: "Another Merchant already uses this phone number.",
      };
    }

    const password = newPassword
      ? await bcrypt.hash(newPassword, 12)
      : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          name,
          phone,
          address,
        },
      });

      await tx.user.update({
        where: { id: merchant.userId! },
        data: {
          name,
          ...(password ? { password } : {}),
        },
      });
    });

    refreshMerchantPages();

    return {
      success: true,
      message: newPassword
        ? "Merchant profile and login password updated successfully."
        : "Merchant profile updated successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update Merchant.",
    };
  }
}

export async function assignMerchantCouriers(input: {
  merchantId: string;
  courierIds: string[];
}): Promise<MerchantActionResult> {
  try {
    await requireAdmin();

    const merchantId = String(input.merchantId || "").trim();
    const courierIds = Array.from(
      new Set((input.courierIds || []).map((id) => String(id || "").trim()).filter(Boolean))
    );

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) return { success: false, message: "Merchant not found." };

    if (courierIds.length) {
      const count = await prisma.courier.count({
        where: { id: { in: courierIds }, status: true },
      });
      if (count !== courierIds.length) {
        return { success: false, message: "One or more selected couriers are invalid." };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.merchantCourier.deleteMany({ where: { merchantId } });
      if (courierIds.length) {
        await tx.merchantCourier.createMany({
          data: courierIds.map((courierId) => ({ merchantId, courierId })),
          skipDuplicates: true,
        });
      }
    });

    refreshMerchantPages();
    return { success: true, message: "Merchant courier access updated." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update courier access.",
    };
  }
}

export async function assignProductParentToMerchant(input: {
  parentId: string;
  merchantId?: string;
}): Promise<MerchantActionResult> {
  try {
    await requireAdmin();

    const parentId = String(input.parentId || "").trim();
    const merchantId = String(input.merchantId || "").trim() || null;

    const parent = await prisma.productParent.findUnique({
      where: { id: parentId },
      select: { id: true, sku: true },
    });
    if (!parent) return { success: false, message: "Product Parent not found." };

    if (merchantId) {
      const merchant = await prisma.merchant.findFirst({
        where: { id: merchantId, status: true },
        select: { id: true },
      });
      if (!merchant) return { success: false, message: "Merchant not found or inactive." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.productParent.update({
        where: { id: parentId },
        data: { merchantId },
      });

      // Keep existing Meta mappings aligned with Product Parent ownership.
      await tx.metaCampaignMapping.updateMany({
        where: { productParentId: parentId },
        data: { merchantId },
      });
    });

    refreshMerchantPages();

    return {
      success: true,
      message: merchantId
        ? parent.sku + " assigned to Merchant."
        : parent.sku + " returned to default OMS ownership.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to assign Product Parent.",
    };
  }
}

export async function rechargeMerchantDollar(input: {
  merchantId: string;
  rechargeDate: string;
  usdAmount: number;
  bdtAmount: number;
  note?: string;
}): Promise<MerchantActionResult> {
  try {
    const session = await requireAdmin();
    const merchantId = String(input.merchantId || "").trim();
    const rechargeDate = String(input.rechargeDate || "").trim();
    const usdAmount = positiveNumber(input.usdAmount);
    const bdtAmount = positiveNumber(input.bdtAmount);
    const note = String(input.note || "").trim();

    if (!merchantId || !/^\d{4}-\d{2}-\d{2}$/.test(rechargeDate)) {
      return { success: false, message: "Merchant and recharge date are required." };
    }
    if (!usdAmount || !bdtAmount) {
      return { success: false, message: "USD amount and total BDT price must be greater than 0." };
    }

    const merchant = await prisma.merchant.findFirst({
      where: { id: merchantId, status: true },
      select: { id: true },
    });
    if (!merchant) return { success: false, message: "Merchant not found or inactive." };

    const usdRate = bdtAmount / usdAmount;

    await prisma.merchantDollarRecharge.create({
      data: {
        merchantId,
        rechargeDate: new Date(rechargeDate + "T00:00:00.000Z"),
        usdAmount,
        bdtAmount,
        usdRate,
        note: note || null,
        createdByUserId: session.user.id,
      },
    });

    refreshMerchantPages();
    return {
      success: true,
      message: "Dollar recharge saved at Tk " + usdRate.toFixed(4) + " per USD.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save dollar recharge.",
    };
  }
}

export async function saveMerchantOperatingCost(input: {
  merchantId: string;
  month: string;
  amount: number;
  note?: string;
}): Promise<MerchantActionResult> {
  try {
    const session = await requireAdmin();
    const merchantId = String(input.merchantId || "").trim();
    const month = String(input.month || "").trim();
    const amount = positiveNumber(input.amount);
    const note = String(input.note || "").trim();

    if (!merchantId || !/^\d{4}-\d{2}$/.test(month) || !amount) {
      return { success: false, message: "Merchant, month and operating cost are required." };
    }

    const merchant = await prisma.merchant.findFirst({
      where: { id: merchantId, status: true },
      select: { id: true },
    });
    if (!merchant) return { success: false, message: "Merchant not found or inactive." };

    const costMonth = new Date(month + "-01T00:00:00.000Z");

    await prisma.merchantOperatingCost.upsert({
      where: {
        merchantId_costMonth: { merchantId, costMonth },
      },
      create: {
        merchantId,
        costMonth,
        amount,
        note: note || null,
        createdByUserId: session.user.id,
      },
      update: {
        amount,
        note: note || null,
        createdByUserId: session.user.id,
      },
    });

    refreshMerchantPages();
    return { success: true, message: "Monthly Merchant operating cost saved." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save operating cost.",
    };
  }
}

export async function omsBuyMerchantProduct(input: {
  merchantId: string;
  productId: string;
  purchaseDate: string;
  quantity: number;
  note?: string;
}): Promise<MerchantActionResult> {
  try {
    const session = await requireAdmin();

    const merchantId = String(input.merchantId || "").trim();
    const productId = String(input.productId || "").trim();
    const purchaseDate = String(input.purchaseDate || "").trim();
    const quantity = positiveInt(input.quantity);
    const note = String(input.note || "").trim();

    if (!merchantId || !productId || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !quantity) {
      return { success: false, message: "Merchant, product, date and quantity are required." };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { parent: true },
    });

    if (!product || !product.status) {
      return { success: false, message: "Product not found or inactive." };
    }
    if (product.inventoryKind === "BUNDLE") {
      return { success: false, message: "Virtual bundles cannot be purchased directly from a Merchant." };
    }
    if (product.parent.merchantId !== merchantId) {
      return {
        success: false,
        message: "This Product Parent is not assigned to the selected Merchant.",
      };
    }

    const parentStock = product.parent.stockMode === "PARENT_STOCK";
    const unitsPerSale = parentStock ? Math.max(1, Number(product.unitsPerSale || 1)) : 1;
    const physicalUnits = quantity * unitsPerSale;

    const physicalStock = parentStock
      ? Number(product.parent.stockQuantity || 0)
      : Number(product.quantity || 0);
    const reservedStock = parentStock
      ? Number(product.parent.omsOwnedStockQuantity || 0)
      : Number(product.omsOwnedStockQuantity || 0);
    const merchantAvailable = Math.max(0, physicalStock - reservedStock);

    if (physicalUnits > merchantAvailable) {
      return {
        success: false,
        message:
          "Merchant has only " +
          merchantAvailable +
          " available physical unit(s) after OMS reserve.",
      };
    }

    const unitCost = parentStock
      ? Number(product.parent.purchasePrice || 0)
      : Number(product.purchasePrice || 0);
    if (unitCost <= 0) {
      return { success: false, message: "Buying price is missing for this product stock owner." };
    }

    const totalCost = unitCost * physicalUnits;
    const stockAfter = merchantAvailable - physicalUnits;

    await prisma.$transaction(async (tx) => {
      if (parentStock) {
        await tx.productParent.update({
          where: { id: product.parentId },
          data: { omsOwnedStockQuantity: { increment: physicalUnits } },
        });
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { omsOwnedStockQuantity: { increment: physicalUnits } },
        });
      }

      await enqueueStockSyncForOwners(tx, [
        {
          ownerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          ownerId: parentStock ? product.parentId : product.id,
        },
      ]);

      await tx.merchantOmsPurchase.create({
        data: {
          merchantId,
          productId: product.id,
          parentId: product.parentId,
          purchaseDate: new Date(purchaseDate + "T00:00:00.000Z"),
          enteredQuantity: quantity,
          physicalUnits,
          stockOwnerType: parentStock ? "PRODUCT_PARENT" : "PRODUCT",
          stockOwnerId: parentStock ? product.parentId : product.id,
          stockBefore: merchantAvailable,
          stockAfter,
          unitCost,
          totalCost,
          note: note || null,
          createdByUserId: session.user.id,
        },
      });
    });

    refreshMerchantPages();

    return {
      success: true,
      message:
        "OMS purchased " +
        quantity +
        " sale unit(s) / " +
        physicalUnits +
        " physical unit(s) for Tk " +
        totalCost.toFixed(2) +
        ".",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to purchase Merchant stock.",
    };
  }
}
