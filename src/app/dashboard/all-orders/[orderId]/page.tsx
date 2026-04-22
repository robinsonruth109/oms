import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AllOrderViewClient from "./view-client";

type Props = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function AllOrderViewPage({ params }: Props) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      source: true,
      page: true,
      integration: true,
    },
  });

  if (!order) {
    notFound();
  }

  const [products, couriers, pages] = await Promise.all([
    prisma.product.findMany({
      where: { status: true },
      include: { parent: true },
      orderBy: {
        sku: "asc",
      },
    }),
    prisma.courier.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <AllOrderViewClient
      order={{
        id: order.id,
        invoiceId: order.invoiceId,
        externalOrderId: order.externalOrderId,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        advance: Number(order.advance),
        deliveryCharge: Number(order.deliveryCharge),
        totalAmount: Number(order.totalAmount),
        orderStatus: order.orderStatus,
        courier: order.courier,
        note: order.note,
        pageId: order.pageId,
        readyToShipAt: order.readyToShipAt
          ? order.readyToShipAt.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        source: {
          id: order.source?.id || "",
          name: order.source?.name || "",
          type: order.source?.type || "",
        },
        page: order.page
          ? {
              id: order.page.id,
              name: order.page.name,
            }
          : null,
        integration: order.integration
          ? {
              id: order.integration.id,
              name: order.integration.name,
              slug: order.integration.slug,
              platform: order.integration.platform,
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }}
      products={products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: Number(p.sellingPrice),
        parentSku: p.parent.sku,
      }))}
      couriers={couriers.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))}
      pages={pages}
    />
  );
}