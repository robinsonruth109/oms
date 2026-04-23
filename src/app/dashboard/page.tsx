import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Users,
  Package,
  ClipboardList,
  PhoneCall,
  Truck,
  Ban,
  PackageX,
  Plug,
  Boxes,
  FileStack,
  Send,
  BarChart3,
  ArrowRight,
  CircleCheckBig,
  CircleAlert,
  Clock3,
  TrendingUp,
  Store,
} from "lucide-react";

export const dynamic = "force-dynamic";

function getLocalDayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function StatCard({
  title,
  value,
  icon,
  href,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  subtitle?: string;
}) {
  const content = (
    <div className="rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          {icon}
        </div>
      </div>

      {href ? (
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          View
          <ArrowRight className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-4 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          {icon}
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function fmtMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

export default async function DashboardHomePage() {
  const { start, end } = getLocalDayRange();

  const [
    totalUsers,
    totalPages,
    totalSources,
    totalIntegrations,
    totalCouriers,
    totalProducts,
    totalOrders,
    pendingOrders,
    noAnswerOrders,
    phoneOffOrders,
    readyToShipOrders,
    stockOutOrders,
    cancelledOrders,
    todayCalledOrders,
    todayReadyToShipOrders,
    todayStockOutOrders,
    todayCancelledOrders,
    recentOrders,
    topAgentsRaw,
    sourceSummaryRaw,
    todayRevenueRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.page.count({
      where: { status: true },
    }),
    prisma.orderSource.count({
      where: { status: true },
    }),
    prisma.integration.count(),
    prisma.courier.count({
      where: { status: true },
    }),
    prisma.product.count({
      where: { status: true },
    }),
    prisma.order.count(),
    prisma.order.count({
      where: {
        orderStatus: "PENDING_CONFIRMATION",
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "NO_ANSWER",
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "PHONE_OFF",
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "READY_TO_SHIP",
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "STOCK_OUT",
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "CANCELLED",
      },
    }),
    prisma.order.count({
      where: {
        calledAt: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "READY_TO_SHIP",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "STOCK_OUT",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.order.count({
      where: {
        orderStatus: "CANCELLED",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        source: true,
        page: true,
      },
      take: 8,
    }),
    prisma.order.findMany({
      where: {
        calledAt: {
          gte: start,
          lte: end,
        },
        calledByUserId: {
          not: null,
        },
      },
      select: {
        id: true,
        orderStatus: true,
        calledByUserId: true,
        calledByUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        source: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        orderStatus: "READY_TO_SHIP",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        totalAmount: true,
      },
    }),
  ]);

  const topAgentsMap = new Map<
    string,
    {
      id: string;
      name: string;
      username: string;
      total: number;
      ready: number;
    }
  >();

  for (const row of topAgentsRaw) {
    if (!row.calledByUserId || !row.calledByUser) continue;

    if (!topAgentsMap.has(row.calledByUserId)) {
      topAgentsMap.set(row.calledByUserId, {
        id: row.calledByUser.id,
        name: row.calledByUser.name,
        username: row.calledByUser.username,
        total: 0,
        ready: 0,
      });
    }

    const item = topAgentsMap.get(row.calledByUserId)!;
    item.total += 1;

    if (row.orderStatus === "READY_TO_SHIP") {
      item.ready += 1;
    }
  }

  const topAgents = Array.from(topAgentsMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const sourceMap = new Map<string, { id: string; name: string; total: number }>();

  for (const row of sourceSummaryRaw) {
    if (!sourceMap.has(row.source.id)) {
      sourceMap.set(row.source.id, {
        id: row.source.id,
        name: row.source.name,
        total: 0,
      });
    }

    sourceMap.get(row.source.id)!.total += 1;
  }

  const topSources = Array.from(sourceMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const todayRevenue = todayRevenueRaw.reduce(
    (sum, item) => sum + Number(item.totalAmount),
    0
  );

  const conversionRate =
    todayCalledOrders > 0
      ? `${((todayReadyToShipOrders / todayCalledOrders) * 100).toFixed(1)}%`
      : "0%";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          OMS Dashboard Panel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of users, setup, orders, calling workflow, shipping and today’s performance.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={<Users className="h-5 w-5" />}
          href="/dashboard/users"
        />
        <StatCard
          title="Page Master"
          value={totalPages}
          icon={<FileStack className="h-5 w-5" />}
          href="/dashboard/pages"
        />
        <StatCard
          title="Source Master"
          value={totalSources}
          icon={<Boxes className="h-5 w-5" />}
          href="/dashboard/sources"
        />
        <StatCard
          title="Integrations"
          value={totalIntegrations}
          icon={<Plug className="h-5 w-5" />}
          href="/dashboard/integrations"
        />
        <StatCard
          title="Couriers"
          value={totalCouriers}
          icon={<Send className="h-5 w-5" />}
          href="/dashboard/couriers"
        />
        <StatCard
          title="Products"
          value={totalProducts}
          icon={<Package className="h-5 w-5" />}
          href="/dashboard/products"
        />
        <StatCard
          title="All Orders"
          value={totalOrders}
          icon={<ClipboardList className="h-5 w-5" />}
          href="/dashboard/orders"
        />
        <StatCard
          title="Called Today"
          value={todayCalledOrders}
          icon={<PhoneCall className="h-5 w-5" />}
          href="/dashboard/reports"
          subtitle="Based on called time"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Pending Orders"
          value={pendingOrders}
          icon={<Clock3 className="h-5 w-5" />}
          href="/dashboard/pending-orders"
        />
        <StatCard
          title="No Answer"
          value={noAnswerOrders}
          icon={<CircleAlert className="h-5 w-5" />}
          href="/dashboard/call"
        />
        <StatCard
          title="Phone Off"
          value={phoneOffOrders}
          icon={<PhoneCall className="h-5 w-5" />}
          href="/dashboard/call"
        />
        <StatCard
          title="Ready to Ship"
          value={readyToShipOrders}
          icon={<Truck className="h-5 w-5" />}
          href="/dashboard/ready-to-ship"
        />
        <StatCard
          title="Stock Out"
          value={stockOutOrders}
          icon={<PackageX className="h-5 w-5" />}
          href="/dashboard/stock-out"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today Ready"
          value={todayReadyToShipOrders}
          icon={<CircleCheckBig className="h-5 w-5" />}
          href="/dashboard/reports"
        />
        <StatCard
          title="Today Stock Out"
          value={todayStockOutOrders}
          icon={<PackageX className="h-5 w-5" />}
          href="/dashboard/reports"
        />
        <StatCard
          title="Today Cancelled"
          value={todayCancelledOrders}
          icon={<Ban className="h-5 w-5" />}
          href="/dashboard/reports"
        />
        <StatCard
          title="Today Conversion"
          value={conversionRate}
          icon={<TrendingUp className="h-5 w-5" />}
          href="/dashboard/reports"
          subtitle="Ready ÷ Called today"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Today Ready Revenue"
          value={fmtMoney(todayRevenue)}
          icon={<BarChart3 className="h-5 w-5" />}
          href="/dashboard/reports"
          subtitle="Sum of today ready-to-ship totals"
        />
        <StatCard
          title="Active Sources Today"
          value={topSources.length}
          icon={<Store className="h-5 w-5" />}
          href="/dashboard/reports"
          subtitle="Sources with orders today"
        />
        <StatCard
          title="Active Agents Today"
          value={topAgents.length}
          icon={<Users className="h-5 w-5" />}
          href="/dashboard/reports"
          subtitle="Agents who called today"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3 rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Orders
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest imported and created orders in the system.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Invoice
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Page
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {order.invoiceId || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div>
                        <p className="font-medium text-slate-900">
                          {order.customerName}
                        </p>
                        <p className="text-slate-500">{order.phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {order.source.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {order.page?.name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {order.orderStatus}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      ৳ {Number(order.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                ))}

                {!recentOrders.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-slate-500"
                    >
                      No recent orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <QuickLink
            href="/dashboard/orders"
            title="Create Order"
            description="Create manual orders and product items."
            icon={<Package className="h-5 w-5" />}
          />
          <QuickLink
            href="/dashboard/call"
            title="Calling Panel"
            description="Call, confirm, cancel or stock out orders."
            icon={<PhoneCall className="h-5 w-5" />}
          />
          <QuickLink
            href="/dashboard/ready-to-ship"
            title="Ready to Ship"
            description="Prepare invoice and CSV batches for courier."
            icon={<Truck className="h-5 w-5" />}
          />
          <QuickLink
            href="/dashboard/reports"
            title="Reports"
            description="Check agent-wise and date-wise performance."
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <QuickLink
            href="/dashboard/cancelled"
            title="Cancelled Orders"
            description="Review cancelled and closed orders."
            icon={<Ban className="h-5 w-5" />}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Top Agents Today
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Agents with highest calling activity today.
            </p>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {topAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {agent.name}
                      </p>
                      <p className="text-sm text-slate-500">@{agent.username}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {agent.total} called
                      </p>
                      <p className="text-xs text-emerald-600">
                        {agent.ready} ready
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {!topAgents.length && (
                <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
                  No agent activity found today.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Top Sources Today
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sources generating the most orders today.
            </p>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {topSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {source.name}
                      </p>
                      <p className="text-sm text-slate-500">Today source activity</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {source.total} orders
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {!topSources.length && (
                <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
                  No source activity found today.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}