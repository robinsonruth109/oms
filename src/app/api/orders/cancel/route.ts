import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { orderId } = await req.json();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: "CANCELLED",
    },
  });

  return Response.json({ success: true });
}
