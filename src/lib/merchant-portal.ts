import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireMerchantContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MERCHANT") redirect("/dashboard");

  const merchant = await prisma.merchant.findUnique({
    where: { userId: session.user.id },
    include: {
      couriers: {
        include: {
          courier: {
            select: {
              id: true,
              name: true,
              pathaoEnabled: true,
            },
          },
        },
      },
    },
  });

  if (!merchant || !merchant.status) {
    redirect("/login");
  }

  return { session, merchant };
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function numberValue(value: unknown) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

export function rawNumber(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    const parsed = Number(
      typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value
    );
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

export function normalizePathaoEvent(value: string) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-");
}

export function merchantPhysicalAvailable(product: {
  quantity: number;
  omsOwnedStockQuantity: number;
  unitsPerSale: number;
  parent: {
    stockMode: string;
    stockQuantity: number;
    omsOwnedStockQuantity: number;
  };
}) {
  if (product.parent.stockMode === "PARENT_STOCK") {
    return Math.max(
      0,
      Number(product.parent.stockQuantity || 0) -
        Number(product.parent.omsOwnedStockQuantity || 0)
    );
  }

  return Math.max(
    0,
    Number(product.quantity || 0) -
      Number(product.omsOwnedStockQuantity || 0)
  );
}

export function cogsForMerchantItem(item: {
  quantity: number;
  product: null | {
    inventoryKind: string;
    purchasePrice: unknown;
    unitsPerSale: number;
    parent: {
      stockMode: string;
      purchasePrice: unknown;
    };
    bundleComponents: {
      units: number;
      componentProduct: { purchasePrice: unknown };
    }[];
  };
}) {
  const product = item.product;
  const qty = Math.max(0, Number(item.quantity || 0));
  if (!product) return 0;

  if (product.inventoryKind === "BUNDLE") {
    const setCost = product.bundleComponents.reduce(
      (sum, part) =>
        sum +
        numberValue(part.componentProduct.purchasePrice) *
          Math.max(0, Number(part.units || 0)),
      0
    );
    return setCost * qty;
  }

  if (product.parent.stockMode === "PARENT_STOCK") {
    return (
      numberValue(product.parent.purchasePrice) *
      Math.max(1, Number(product.unitsPerSale || 1)) *
      qty
    );
  }

  return numberValue(product.purchasePrice) * qty;
}

export function formatTaka(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsd(value: number) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
