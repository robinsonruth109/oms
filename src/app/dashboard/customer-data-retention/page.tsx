import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import {
  CUSTOMER_DATA_RETENTION_DAYS,
  DELETED_PHONE,
  getCustomerDataRetentionCutoff,
  getEligibleCustomerDataWhere,
} from "@/lib/customer-data-retention";

import RetentionClient from "./retention-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function CustomerDataRetentionPage() {
  const [{ authOptions }, { prisma }] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/prisma"),
  ]);

  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const cutoff = getCustomerDataRetentionCutoff();

  const [totalOrders, eligibleOrders, anonymizedOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: getEligibleCustomerDataWhere(cutoff),
      }),
      prisma.order.count({
        where: {
          phone: DELETED_PHONE,
        },
      }),
    ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
            Administration
          </p>

          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Customer Data Retention
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Download a complete CSV backup before manually anonymizing
                customer personal data that is older than{" "}
                {CUSTOMER_DATA_RETENTION_DAYS} days. Order, invoice, product,
                quantity, status and financial records are preserved.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current cutoff
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatDateTime(cutoff)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Bangladesh time
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total orders
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {totalOrders.toLocaleString("en-US")}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              Eligible for manual cleanup
            </p>
            <p className="mt-2 text-3xl font-black text-amber-950">
              {eligibleOrders.toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Older than {CUSTOMER_DATA_RETENTION_DAYS} days
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Already anonymized
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {anonymizedOrders.toLocaleString("en-US")}
            </p>
          </div>
        </section>

        <RetentionClient
          eligibleCount={eligibleOrders}
          retentionDays={CUSTOMER_DATA_RETENTION_DAYS}
          cutoffIso={cutoff.toISOString()}
        />
      </div>
    </div>
  );
}
