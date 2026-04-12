import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CallingOrderView from "./view-client";

type Props = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function CallingOrderViewPage({ params }: Props) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      source: true,
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
      take: 1000,
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
        prefixCode: true,
      },
    }),
  ]);

  return (
    <CallingOrderView
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
          name: order.source.name,
          type: order.source.type,
        },
        integration: order.integration
          ? {
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
      pages={pages.map((p) => ({
        id: p.id,
        name: p.name,
      }))}
    />
  );
}