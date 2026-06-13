import { notFound } from "next/navigation";
import PurchaseOrderDetailsClient from "./purchase-order-details-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseOrderDetailsPage({ params }: PageProps) {
  const { prisma } = await import("@/lib/prisma");
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: {
          paymentDate: "asc",
        },
      },
      product: {
        include: {
          parent: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const payments = order.payments.map((payment) => ({
    id: payment.id,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    paymentType: payment.paymentType,
    amountUsd: Number(payment.amountUsd),
    usdRate: Number(payment.usdRate),
    amountBdt: Number(payment.amountBdt),
    note: payment.note,
  }));

  const totalPayableUsd = Number(order.subtotalUsd);

  const totalPaidUsd = payments.reduce(
    (sum, payment) => sum + payment.amountUsd,
    0
  );

  const totalPaidBdt = payments.reduce(
    (sum, payment) => sum + payment.amountBdt,
    0
  );

  const dueUsd = Math.max(totalPayableUsd - totalPaidUsd, 0);

  const averageUsdRate =
    totalPaidUsd > 0 ? totalPaidBdt / totalPaidUsd : 0;

  return (
    <PurchaseOrderDetailsClient
      order={{
        id: order.id,
        invoiceNo: order.invoiceNo,
        productSku: order.productSku,
        productName: order.productName,
        parentSku: order.parentSku,
        orderDate: order.orderDate.toISOString().slice(0, 10),
        quantity: order.quantity,
        quantityType: order.quantityType,
        productImage: order.productImage,
        unitPriceUsd: Number(order.unitPriceUsd),
        platformChargeUsd: Number(order.platformChargeUsd),
        shippingUsd: Number(order.shippingUsd),
        subtotalUsd: Number(order.subtotalUsd),
        status: order.status,
        note: order.note,
        createdAt: order.createdAt.toISOString().slice(0, 10),
      }}
      payments={payments}
      summary={{
        totalPayableUsd,
        totalPaidUsd,
        totalPaidBdt,
        dueUsd,
        averageUsdRate,
      }}
    />
  );
}