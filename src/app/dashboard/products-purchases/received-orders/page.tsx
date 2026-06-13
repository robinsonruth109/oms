import ReceivedOrdersClient from "./received-orders-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReceivedOrdersPage() {
  const { prisma } = await import("@/lib/prisma");

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: ["PAID", "PARTIAL_RECEIVED", "RECEIVED"],
      },
    },
    include: {
      payments: true,
      receivedOrders: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = purchaseOrders.map((order) => {
    const paidAmountBdt = order.payments.reduce(
      (sum, payment) => sum + Number(payment.amountBdt),
      0
    );

    const totalReceivedQty = order.receivedOrders.reduce(
      (sum, received) => sum + received.receivedQty,
      0
    );

    const totalGrandBdt = order.receivedOrders.reduce(
      (sum, received) => sum + Number(received.grandTotalBdt),
      0
    );

    const averageOriginalPrice =
      totalReceivedQty > 0 ? totalGrandBdt / totalReceivedQty : 0;

    return {
      id: order.id,
      invoiceNo: order.invoiceNo,
      productSku: order.productSku,
      productName: order.productName,
      parentSku: order.parentSku,
      orderedQty: order.quantity,
      quantityType: order.quantityType,
      paidAmountBdt,
      receivedQty: totalReceivedQty,
      remainingQty: Math.max(order.quantity - totalReceivedQty, 0),
      totalGrandBdt,
      averageOriginalPrice,
      status: order.status,
    };
  });

  return (
    <ReceivedOrdersClient rows={rows} />
  );
}