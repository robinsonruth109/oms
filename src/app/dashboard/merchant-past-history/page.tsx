import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import MerchantPastHistoryClient from "./merchant-past-history-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MerchantPastHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  // Load Prisma only at request time. This keeps Next/Railway build-time page
  // collection from trying to open the production database.
  const { prisma } = await import("@/lib/prisma");

  const [merchants, history] = await Promise.all([
    prisma.merchant.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        omsAccountingStartDate: true,
        productParents: {
          select: { id: true, sku: true, name: true },
          orderBy: { sku: "asc" },
        },
        stockAllocations: {
          select: {
            parentId: true,
            parent: { select: { id: true, sku: true, name: true } },
          },
          orderBy: { allocationDate: "desc" },
        },
      },
    }),
    prisma.merchantPastHistory.findMany({
      orderBy: [{ historyMonth: "desc" }, { merchant: { name: "asc" } }, { parent: { sku: "asc" } }],
      include: {
        merchant: { select: { id: true, name: true } },
        parent: { select: { id: true, sku: true, name: true } },
      },
      take: 5000,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-950">Merchant Past History</h1>
        <p className="mt-1 max-w-5xl text-sm text-slate-500">
          Enter month-wise Merchant performance from before OMS accounting started.
          The border date separates manual historical records from live OMS accounting.
        </p>
      </section>

      <MerchantPastHistoryClient
        merchants={merchants.map((merchant) => {
          const parentMap = new Map<
            string,
            { id: string; sku: string; name: string }
          >();

          merchant.productParents.forEach((parent) => parentMap.set(parent.id, parent));
          merchant.stockAllocations.forEach((row) =>
            parentMap.set(row.parent.id, row.parent)
          );

          return {
            id: merchant.id,
            name: merchant.name,
            omsAccountingStartDate:
              merchant.omsAccountingStartDate?.toISOString().slice(0, 10) || "",
            assignedParents: Array.from(parentMap.values()).sort((a, b) =>
              a.sku.localeCompare(b.sku)
            ),
          };
        })}
        history={history.map((row) => ({
          id: row.id,
          merchantId: row.merchantId,
          merchantName: row.merchant.name,
          parentId: row.parentId,
          parentSku: row.parent.sku,
          parentName: row.parent.name,
          historyMonth: row.historyMonth.toISOString().slice(0, 7),
          courierSendQty: row.courierSendQty,
          returnReceivedQty: row.returnReceivedQty,
          adsCostBdt: Number(row.adsCostBdt),
          returnCost: Number(row.returnCost),
          discount: Number(row.discount),
          profit: Number(row.profit),
          note: row.note || "",
        }))}
      />
    </div>
  );
}
