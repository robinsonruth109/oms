import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import MerchantControlClient from "./merchant-control-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantControlPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { prisma } = await import("@/lib/prisma");

  const [merchants, couriers, parents, products] = await Promise.all([
    prisma.merchant.findMany({
      orderBy: [{ status: "desc" }, { name: "asc" }],
      include: {
        user: { select: { username: true, status: true } },
        couriers: { include: { courier: { select: { id: true, name: true } } } },
        productParents: { select: { id: true, sku: true, name: true } },
        dollarRecharges: {
          orderBy: { rechargeDate: "desc" },
          take: 5,
        },
        operatingCosts: {
          orderBy: { costMonth: "desc" },
          take: 3,
        },
        omsPurchases: {
          orderBy: { purchaseDate: "desc" },
          take: 5,
          include: {
            product: { select: { sku: true, name: true } },
          },
        },
      },
    }),
    prisma.courier.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, pathaoEnabled: true },
    }),
    prisma.productParent.findMany({
      where: { status: true },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        merchantId: true,
        stockMode: true,
        stockQuantity: true,
        omsOwnedStockQuantity: true,
        purchasePrice: true,
      },
    }),
    prisma.product.findMany({
      where: { status: true, inventoryKind: "PHYSICAL" },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        quantity: true,
        omsOwnedStockQuantity: true,
        unitsPerSale: true,
        purchasePrice: true,
        parentId: true,
        parent: {
          select: {
            sku: true,
            name: true,
            merchantId: true,
            stockMode: true,
            stockQuantity: true,
            omsOwnedStockQuantity: true,
            purchasePrice: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Merchant Control</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Create Merchant accounts, assign Product Parents and couriers, recharge
          Meta dollars, set monthly operating cost, and reserve Merchant stock
          purchased by OMS. Unassigned ownership remains default OMS.
        </p>
      </section>

      <MerchantControlClient
        merchants={merchants.map((merchant) => ({
          id: merchant.id,
          name: merchant.name,
          phone: merchant.phone,
          address: merchant.address,
          status: merchant.status,
          username: merchant.user?.username || "",
          loginEnabled: merchant.user?.status ?? false,
          courierIds: merchant.couriers.map((row) => row.courierId),
          courierNames: merchant.couriers.map((row) => row.courier.name),
          parentCount: merchant.productParents.length,
          parentCodes: merchant.productParents.slice(0, 8).map((row) => row.sku),
          recentRecharges: merchant.dollarRecharges.map((row) => ({
            id: row.id,
            date: row.rechargeDate.toISOString(),
            usd: Number(row.usdAmount),
            bdt: Number(row.bdtAmount),
            rate: Number(row.usdRate),
          })),
          recentOperatingCosts: merchant.operatingCosts.map((row) => ({
            id: row.id,
            month: row.costMonth.toISOString(),
            amount: Number(row.amount),
          })),
          recentOmsPurchases: merchant.omsPurchases.map((row) => ({
            id: row.id,
            date: row.purchaseDate.toISOString(),
            sku: row.product.sku,
            name: row.product.name,
            quantity: row.enteredQuantity,
            physicalUnits: row.physicalUnits,
            totalCost: Number(row.totalCost),
          })),
        }))}
        couriers={couriers}
        parents={parents.map((parent) => ({
          ...parent,
          stockQuantity: Number(parent.stockQuantity),
          omsOwnedStockQuantity: Number(parent.omsOwnedStockQuantity),
          purchasePrice: Number(parent.purchasePrice || 0),
        }))}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          parentId: product.parentId,
          parentSku: product.parent.sku,
          merchantId: product.parent.merchantId,
          stockMode: product.parent.stockMode,
          quantity: Number(product.quantity),
          parentQuantity: Number(product.parent.stockQuantity),
          omsOwnedStockQuantity: Number(product.omsOwnedStockQuantity),
          parentOmsOwnedStockQuantity: Number(product.parent.omsOwnedStockQuantity),
          unitsPerSale: Number(product.unitsPerSale),
          purchasePrice: Number(product.purchasePrice),
          parentPurchasePrice: Number(product.parent.purchasePrice || 0),
        }))}
      />
    </div>
  );
}
