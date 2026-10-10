import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PurchaseOrdersClient from "./purchase-orders-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PurchaseOrdersPage() {
  const session = await getServerSession(authOptions);
  const { prisma } = await import("@/lib/prisma");

  const [products, orders, merchants] = await Promise.all([
    prisma.product.findMany({
      where: { status: true },
      include: { parent: true },
      orderBy: { sku: "asc" },
    }),

    prisma.purchaseOrder.findMany({
      include: {
        payments: true,
        merchant: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.merchant.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Purchase Orders
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create product purchase orders and track purchase cost by product code.
        </p>
      </section>

      <PurchaseOrdersClient
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          parentSku: product.parent.sku,
          merchantId: product.parent.merchantId,
        }))}
        merchants={merchants}
        canSelectMerchant={session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER"}
        orders={orders.map((order) => {
          const totalPaidBdt = order.payments.reduce(
            (sum, payment) => sum + Number(payment.amountBdt),
            0
          );

          return {
            id: order.id,
            invoiceNo: order.invoiceNo,
            productSku: order.productSku,
            productName: order.productName,
            parentSku: order.parentSku,
            merchantId: order.merchantId,
            merchantName: order.merchant?.name || "OMS",
            quantity: order.quantity,
            quantityType: order.quantityType,
            subtotalUsd: Number(order.subtotalUsd),
            totalPaidBdt,
            status: order.status,
            createdAt: order.createdAt.toISOString(),
          };
        })}
      />
    </div>
  );
}