import { prisma } from "@/lib/prisma";
import CreateCourierForm from "./create-courier-form";
import CourierStatusButton from "./courier-row-actions";

export default async function CouriersPage() {
  const couriers = await prisma.courier.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Courier Master</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage dynamic courier options for the whole OMS.
        </p>
      </section>

      <CreateCourierForm />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Courier List
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Activate or deactivate couriers any time.
          </p>
        </div>

        <div className="space-y-4 p-4 lg:hidden">
          {couriers.map((courier) => (
            <div
              key={courier.id}
              className="rounded-2xl border bg-slate-50 p-4"
            >
              <div className="space-y-2">
                <p className="text-lg font-semibold text-slate-900">
                  {courier.name}
                </p>
                <p className="text-sm text-slate-500">Slug: {courier.slug}</p>
                <p className="text-sm text-slate-500">
                  Status: {courier.status ? "Active" : "Inactive"}
                </p>
              </div>

              <div className="mt-4">
                <CourierStatusButton
                  courierId={courier.id}
                  nextStatus={!courier.status}
                  label={courier.status ? "Deactivate" : "Activate"}
                />
              </div>
            </div>
          ))}

          {!couriers.length && (
            <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              No courier found.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Slug
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created At
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {couriers.map((courier) => (
                <tr key={courier.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {courier.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {courier.slug}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {courier.status ? "Active" : "Inactive"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {courier.createdAt.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <CourierStatusButton
                      courierId={courier.id}
                      nextStatus={!courier.status}
                      label={courier.status ? "Deactivate" : "Activate"}
                    />
                  </td>
                </tr>
              ))}

              {!couriers.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No courier found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}