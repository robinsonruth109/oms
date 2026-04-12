import { prisma } from "@/lib/prisma";

function generateInvoice() {
  return "GL" + Math.floor(10000 + Math.random() * 90000);
}

export async function POST(req: Request) {
  const { orderId, courier } = await req.json();

  const invoice = generateInvoice();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: "READY_TO_SHIP",
      courier,
      invoiceCode: invoice,
      calledAt: new Date(),
    },
  });

  return Response.json({ success: true });
}