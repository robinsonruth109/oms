import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import StockControlClient from "./stock-control-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function StockControlPage({
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();

  const where = q
    ? {
        OR: [
          {
            sku: {
              contains: q,
            },
          },
          {
            name: {
              contains: q,
            },
          },
          {
            products: {
              some: {
                OR: [
                  {
                    sku: {
                      contains: q,
                    },
                  },
                  {
                    name: {
                      contains: q,
                    },
                  },
                ],
              },
            },
          },
        ],
      }
    : undefined;

  const [parents, stocks, movements] = await Promise.all([
    prisma.productParent.findMany({
      where,
      include: {
        inventoryStock: true,
        products: {
          where: { status: true },
          include: {
            inventoryStock: true,
          },
          orderBy: {
            sku: "asc",
          },
        },
      },
      orderBy: {
        sku: "asc",
      },
      take: 50,
    }),
    prisma.inventoryStock.findMany({
      select: {
        quantity: true,
        averageCost: true,
      },
    }),
    prisma.inventoryMovement.findMany({
      include: {
        inventoryStock: {
          include: {
            parent: {
              select: {
                sku: true,
              },
            },
            product: {
              select: {
                sku: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
  ]);

  const physicalUnits = stocks.reduce(
    (sum, stock) => sum + Number(stock.quantity || 0),
    0
  );

  const valuation = stocks.reduce(
    (sum, stock) =>
      sum +
      Number(stock.quantity || 0) *
        Number(stock.averageCost || 0),
    0
  );

  const negativeTargets = stocks.filter(
    (stock) => Number(stock.quantity || 0) <= 0
  ).length;

  return (
    <StockControlClient
      q={q}
      summary={{
        trackedTargets: stocks.length,
        physicalUnits,
        valuation,
        negativeTargets,
      }}
      parents={parents.map((parent) => ({
        id: parent.id,
        sku: parent.sku,
        name: parent.name,
        inventoryMode: parent.inventoryMode,
        stock: parent.inventoryStock
          ? {
              id: parent.inventoryStock.id,
              quantity: parent.inventoryStock.quantity,
              averageCost: String(parent.inventoryStock.averageCost),
              activatedAt: parent.inventoryStock.activatedAt.toISOString(),
            }
          : null,
        products: parent.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unitsPerSale: product.unitsPerSale,
          purchasePrice: String(product.purchasePrice),
          sellingPrice: String(product.sellingPrice),
          stock: product.inventoryStock
            ? {
                id: product.inventoryStock.id,
                quantity: product.inventoryStock.quantity,
                averageCost: String(product.inventoryStock.averageCost),
                activatedAt: product.inventoryStock.activatedAt.toISOString(),
              }
            : null,
        })),
      }))}
      movements={movements.map((movement) => ({
        id: movement.id,
        movementType: movement.movementType,
        quantityChange: movement.quantityChange,
        balanceBefore: movement.balanceBefore,
        balanceAfter: movement.balanceAfter,
        averageCostAfter: String(movement.averageCostAfter),
        createdAt: movement.createdAt.toISOString(),
        target:
          movement.inventoryStock.parent?.sku ||
          movement.inventoryStock.product?.sku ||
          "Unknown",
        note: movement.note || "",
      }))}
    />
  );
}
