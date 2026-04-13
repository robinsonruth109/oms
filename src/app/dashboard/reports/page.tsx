import { prisma } from "@/lib/prisma";

type ReportsPageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    agentId?: string;
  }>;
};

function getLocalDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Bucket = {
  totalCalled: number;
  readyToShip: number;
  noAnswer: number;
  phoneOff: number;
  stockOut: number;
  cancelled: number;
  pendingConfirmation: number;
  other: number;
};

function createBucket(): Bucket {
  return {
    totalCalled: 0,
    readyToShip: 0,
    noAnswer: 0,
    phoneOff: 0,
    stockOut: 0,
    cancelled: 0,
    pendingConfirmation: 0,
    other: 0,
  };
}

function applyStatus(bucket: Bucket, status: string) {
  bucket.totalCalled += 1;

  switch (status) {
    case "READY_TO_SHIP":
      bucket.readyToShip += 1;
      break;
    case "NO_ANSWER":
      bucket.noAnswer += 1;
      break;
    case "PHONE_OFF":
      bucket.phoneOff += 1;
      break;
    case "STOCK_OUT":
      bucket.stockOut += 1;
      break;
    case "CANCELLED":
      bucket.cancelled += 1;
      break;
    case "PENDING_CONFIRMATION":
      bucket.pendingConfirmation += 1;
      break;
    default:
      bucket.other += 1;
      break;
  }
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const params = (await searchParams) || {};

  const today = getLocalDateInputValue();
  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const agentId = (params.agentId || "").trim();

  const whereBase: Record<string, unknown> = {
    calledAt: {
      gte: startOfDay(from),
      lte: endOfDay(to),
    },
    calledByUserId: {
      not: null,
    },
  };

  if (agentId) {
    whereBase.calledByUserId = agentId;
  }

  const [agents, orders] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "AGENT"],
        },
        status: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
    }),
    prisma.order.findMany({
      where: whereBase,
      select: {
        id: true,
        orderStatus: true,
        calledAt: true,
        calledByUserId: true,
        courier: true,
        source: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        calledByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: {
        calledAt: "desc",
      },
    }),
  ]);

  const agentGrouped = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      username: string;
      role: string;
    } & Bucket
  >();

  const sourceGrouped = new Map<
    string,
    {
      sourceId: string;
      sourceName: string;
      sourceType: string;
    } & Bucket
  >();

  const courierGrouped = new Map<
    string,
    {
      courier: string;
    } & Bucket
  >();

  const dayGrouped = new Map<
    string,
    {
      label: string;
      dateKey: string;
    } & Bucket
  >();

  for (const order of orders) {
    if (order.calledByUserId && order.calledByUser) {
      if (!agentGrouped.has(order.calledByUserId)) {
        agentGrouped.set(order.calledByUserId, {
          agentId: order.calledByUser.id,
          agentName: order.calledByUser.name,
          username: order.calledByUser.username,
          role: order.calledByUser.role,
          ...createBucket(),
        });
      }
      applyStatus(agentGrouped.get(order.calledByUserId)!, order.orderStatus);
    }

    const sourceKey = order.source.id;
    if (!sourceGrouped.has(sourceKey)) {
      sourceGrouped.set(sourceKey, {
        sourceId: order.source.id,
        sourceName: order.source.name,
        sourceType: order.source.type,
        ...createBucket(),
      });
    }
    applyStatus(sourceGrouped.get(sourceKey)!, order.orderStatus);

    const courierKey = order.courier || "No Courier";
    if (!courierGrouped.has(courierKey)) {
      courierGrouped.set(courierKey, {
        courier: courierKey,
        ...createBucket(),
      });
    }
    applyStatus(courierGrouped.get(courierKey)!, order.orderStatus);

    if (order.calledAt) {
      const dateKey = getLocalDateInputValue(order.calledAt);
      if (!dayGrouped.has(dateKey)) {
        dayGrouped.set(dateKey, {
          dateKey,
          label: formatDay(order.calledAt),
          ...createBucket(),
        });
      }
      applyStatus(dayGrouped.get(dateKey)!, order.orderStatus);
    }
  }

  const agentRows = Array.from(agentGrouped.values()).sort(
    (a, b) => b.totalCalled - a.totalCalled
  );

  const sourceRows = Array.from(sourceGrouped.values()).sort(
    (a, b) => b.totalCalled - a.totalCalled
  );

  const courierRows = Array.from(courierGrouped.values()).sort(
    (a, b) => b.totalCalled - a.totalCalled
  );

  const dailyRows = Array.from(dayGrouped.values()).sort((a, b) =>
    a.dateKey < b.dateKey ? 1 : -1
  );

  const totals = orders.reduce((acc, order) => {
    applyStatus(acc, order.orderStatus);
    return acc;
  }, createBucket());

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Agent-wise, source-wise, courier-wise and date-wise calling report.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label
              htmlFor="from"
              className="text-sm font-medium text-slate-700"
            >
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="to" className="text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="agentId"
              className="text-sm font-medium text-slate-700"
            >
              Agent
            </label>
            <select
              id="agentId"
              name="agentId"
              defaultValue={agentId}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Called</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totals.totalCalled}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ready to Ship</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {totals.readyToShip}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">No Answer</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">
            {totals.noAnswer}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Phone Off</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">
            {totals.phoneOff}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Stock Out</p>
          <p className="mt-2 text-2xl font-bold text-purple-600">
            {totals.stockOut}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cancelled</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {totals.cancelled}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Agent Wise Performance
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Based on called orders between {from} and {to}.
          </p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Agent
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Called
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ready
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No Answer
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Off
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock Out
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cancelled
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pending
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conversion
                </th>
              </tr>
            </thead>

            <tbody>
              {agentRows.map((row) => (
                <tr key={row.agentId} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.agentName}
                      </p>
                      <p className="text-slate-500">@{row.username}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-slate-900">
                    {row.totalCalled}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-emerald-600">
                    {row.readyToShip}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">
                    {row.noAnswer}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">
                    {row.phoneOff}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-purple-600">
                    {row.stockOut}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-red-600">
                    {row.cancelled}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-amber-600">
                    {row.pendingConfirmation}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-slate-900">
                    {percent(row.readyToShip, row.totalCalled)}
                  </td>
                </tr>
              ))}

              {!agentRows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No report data found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 p-4 lg:hidden">
          {agentRows.map((row) => (
            <div key={row.agentId} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {row.agentName}
                  </h3>
                  <p className="text-sm text-slate-500">@{row.username}</p>
                </div>
                <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  {row.role}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Total Called</p>
                  <p className="font-medium text-slate-800">{row.totalCalled}</p>
                </div>
                <div>
                  <p className="text-slate-400">Conversion</p>
                  <p className="font-medium text-emerald-600">
                    {percent(row.readyToShip, row.totalCalled)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Ready</p>
                  <p className="font-medium text-emerald-600">
                    {row.readyToShip}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">No Answer</p>
                  <p className="font-medium text-slate-800">{row.noAnswer}</p>
                </div>
                <div>
                  <p className="text-slate-400">Phone Off</p>
                  <p className="font-medium text-slate-800">{row.phoneOff}</p>
                </div>
                <div>
                  <p className="text-slate-400">Stock Out</p>
                  <p className="font-medium text-purple-600">
                    {row.stockOut}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Cancelled</p>
                  <p className="font-medium text-red-600">{row.cancelled}</p>
                </div>
                <div>
                  <p className="text-slate-400">Pending</p>
                  <p className="font-medium text-amber-600">
                    {row.pendingConfirmation}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {!agentRows.length && (
            <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              No report data found for the selected filter.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Source Wise Report
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Called
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ready
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cancelled
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.sourceId} className="border-b last:border-b-0">
                    <td className="px-5 py-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {row.sourceName}
                        </p>
                        <p className="text-slate-500">{row.sourceType}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-sm">
                      {row.totalCalled}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-emerald-600">
                      {row.readyToShip}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-red-600">
                      {row.cancelled}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-semibold text-slate-900">
                      {percent(row.readyToShip, row.totalCalled)}
                    </td>
                  </tr>
                ))}

                {!sourceRows.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-slate-500"
                    >
                      No source report data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Courier Wise Report
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Courier
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Called
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ready
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cancelled
                  </th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conversion
                  </th>
                </tr>
              </thead>
              <tbody>
                {courierRows.map((row) => (
                  <tr key={row.courier} className="border-b last:border-b-0">
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {row.courier}
                    </td>
                    <td className="px-5 py-4 text-center text-sm">
                      {row.totalCalled}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-emerald-600">
                      {row.readyToShip}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-red-600">
                      {row.cancelled}
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-semibold text-slate-900">
                      {percent(row.readyToShip, row.totalCalled)}
                    </td>
                  </tr>
                ))}

                {!courierRows.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-slate-500"
                    >
                      No courier report data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Called
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ready
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No Answer
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Off
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock Out
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cancelled
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conversion
                </th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.dateKey} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {row.label}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {row.totalCalled}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-emerald-600">
                    {row.readyToShip}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {row.noAnswer}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {row.phoneOff}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-purple-600">
                    {row.stockOut}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-red-600">
                    {row.cancelled}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-slate-900">
                    {percent(row.readyToShip, row.totalCalled)}
                  </td>
                </tr>
              ))}

              {!dailyRows.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No daily report data found.
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