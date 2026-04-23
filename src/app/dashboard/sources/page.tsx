import CreateSourceForm from "./create-source-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SourcesPage() {
  const { prisma } = await import("@/lib/prisma");

  const sources = await prisma.orderSource.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Source Master</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage Shopify stores, Laravel sites, and manual sources.
        </p>
      </section>

      <CreateSourceForm />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {source.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {source.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {source.status ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}