import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";
import StockOutImportClient from "./stock-out-import-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StockOutImportPage() {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");

  const [pages, sources, couriers, products, batches] = await Promise.all([
    prisma.page.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.orderSource.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.courier.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.product.findMany({
      where: { status: true },
      orderBy: { sku: "asc" },
      include: {
        parent: {
          select: { sku: true },
        },
      },
    }),
    prisma.stockOutRestoreBatch.findMany({
      include: {
        createdByUser: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Stock Out Restore Import
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload historical stock-out memo CSVs, review Page / Source / Courier /
          Product matches, then send verified orders directly to Ready to Ship.
        </p>
      </section>

      <StockOutImportClient
        masters={{
          pages,
          sources,
          couriers,
          products: products.map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            parentSku: product.parent.sku,
            sellingPrice: Number(product.sellingPrice),
          })),
        }}
      />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Previous Restore Imports</h2>
          <p className="mt-1 text-sm text-slate-500">
            Last 30 audited batches.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Batch</th>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">By</th>
                <th className="px-5 py-3">Rows</th>
                <th className="px-5 py-3">Imported</th>
                <th className="px-5 py-3">Restored</th>
                <th className="px-5 py-3">Skipped</th>
                <th className="px-5 py-3">Failed</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-t">
                  <td className="px-5 py-3 font-semibold">{batch.batchNo}</td>
                  <td className="px-5 py-3">{batch.fileName}</td>
                  <td className="px-5 py-3">
                    {formatBangladeshDateTime(batch.createdAt)}
                  </td>
                  <td className="px-5 py-3">{batch.createdByUser.name}</td>
                  <td className="px-5 py-3">{batch.totalRows}</td>
                  <td className="px-5 py-3 text-blue-600">
                    {batch.importedCount}
                  </td>
                  <td className="px-5 py-3 text-violet-600">
                    {batch.restoredCount}
                  </td>
                  <td className="px-5 py-3">{batch.skippedCount}</td>
                  <td className="px-5 py-3 text-red-600">
                    {batch.failedCount}
                  </td>
                </tr>
              ))}

              {!batches.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No Stock Out restore import has been run yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
