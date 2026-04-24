import CreatePageForm from "./create-page-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PagesPage() {
  const { prisma } = await import("@/lib/prisma");
  const pages = await prisma.page.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Page Master</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage manual/Facebook pages and invoice prefix codes.
        </p>
      </section>

      <CreatePageForm />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prefix Code
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last Invoice Serial
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {page.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {page.prefixCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {page.lastInvoiceSerial}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {page.status ? "Active" : "Inactive"}
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