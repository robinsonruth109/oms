import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getBangladeshDateInputValue,
  getBangladeshDayRange,
} from "@/lib/bangladesh-time";
import LiveRefresh from "./live-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    agent?: string;
  }>;
};

type AgentRow = {
  id: string;
  name: string;
  username: string;
  totalCalled: number;
  readyToShip: number;
  noAnswer: number;
  phoneOff: number;
  stockOut: number;
  cancelled: number;
  pending: number;
  doubleOrder: number;
  returned: number;
};

function safeDate(value: string | undefined, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? String(value)
    : fallback;
}

function percent(ready: number, total: number) {
  if (!total) return "0.0%";
  return `${((ready / total) * 100).toFixed(1)}%`;
}

export default async function LiveCallReportPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["ADMIN", "AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  const from = safeDate(params.from, today);
  const to = safeDate(params.to, today);

  const fromRange = getBangladeshDayRange(from);
  const toRange = getBangladeshDayRange(to);

  // Keep the range valid even if the user accidentally reverses the dates.
  const start = fromRange.start <= toRange.end ? fromRange.start : toRange.start;
  const end = fromRange.start <= toRange.end ? toRange.end : fromRange.end;

  const isAdmin = session.user.role === "ADMIN";

  const agents = isAdmin
    ? await prisma.user.findMany({
        where: {
          role: "AGENT",
          status: true,
        },
        select: {
          id: true,
          name: true,
          username: true,
        },
        orderBy: { name: "asc" },
      })
    : [
        {
          id: session.user.id,
          name: session.user.name || "Agent",
          username: session.user.username || "",
        },
      ];

  const requestedAgentId = String(params.agent || "").trim();
  const selectedAgentId = isAdmin
    ? agents.some((agent) => agent.id === requestedAgentId)
      ? requestedAgentId
      : ""
    : session.user.id;

  const calledOrders = await prisma.order.findMany({
    where: {
      calledAt: {
        gte: start,
        lte: end,
      },
      calledByUserId: selectedAgentId
        ? selectedAgentId
        : {
            in: agents.map((agent) => agent.id),
          },
    },
    select: {
      id: true,
      orderStatus: true,
      calledByUserId: true,
      calledAt: true,
    },
  });

  const rowMap = new Map<string, AgentRow>(
    agents.map((agent) => [
      agent.id,
      {
        id: agent.id,
        name: agent.name,
        username: agent.username,
        totalCalled: 0,
        readyToShip: 0,
        noAnswer: 0,
        phoneOff: 0,
        stockOut: 0,
        cancelled: 0,
        pending: 0,
        doubleOrder: 0,
        returned: 0,
      },
    ])
  );

  for (const order of calledOrders) {
    if (!order.calledByUserId) continue;
    const row = rowMap.get(order.calledByUserId);
    if (!row) continue;

    row.totalCalled += 1;

    switch (order.orderStatus) {
      case "READY_TO_SHIP":
        row.readyToShip += 1;
        break;
      case "NO_ANSWER":
        row.noAnswer += 1;
        break;
      case "PHONE_OFF":
        row.phoneOff += 1;
        break;
      case "STOCK_OUT":
        row.stockOut += 1;
        break;
      case "CANCELLED":
        row.cancelled += 1;
        break;
      case "PENDING_CONFIRMATION":
        row.pending += 1;
        break;
      case "DOUBLE_ORDER":
        row.doubleOrder += 1;
        break;
      case "RETURNED":
        row.returned += 1;
        break;
    }
  }

  const agentRows = [...rowMap.values()]
    .filter((row) => !selectedAgentId || row.id === selectedAgentId)
    .filter((row) => row.totalCalled > 0 || !isAdmin)
    .sort((a, b) => b.totalCalled - a.totalCalled);

  const totals = agentRows.reduce(
    (sum, row) => ({
      totalCalled: sum.totalCalled + row.totalCalled,
      readyToShip: sum.readyToShip + row.readyToShip,
      noAnswer: sum.noAnswer + row.noAnswer,
      phoneOff: sum.phoneOff + row.phoneOff,
      stockOut: sum.stockOut + row.stockOut,
      cancelled: sum.cancelled + row.cancelled,
      pending: sum.pending + row.pending,
    }),
    {
      totalCalled: 0,
      readyToShip: 0,
      noAnswer: 0,
      phoneOff: 0,
      stockOut: 0,
      cancelled: 0,
      pending: 0,
    }
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Live Call Report
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Agent calling performance based strictly on{" "}
              <strong>Called At</strong> time in Bangladesh time — not order
              import/create date.
            </p>
          </div>

          <LiveRefresh />
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <form className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">From Date</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">To Date</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>

          {isAdmin ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Agent</span>
              <select
                name="agent"
                defaultValue={selectedAgentId}
                className="w-full rounded-xl border bg-white px-3 py-2.5"
              >
                <option value="">All Agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} (@{agent.username})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-1.5 text-sm">
              <span className="font-medium text-slate-700">Agent</span>
              <div className="rounded-xl border bg-slate-50 px-3 py-2.5 font-medium">
                {session.user.name} (@{session.user.username})
              </div>
            </div>
          )}

          <button className="self-end rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Apply Filters
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Called</p>
          <p className="mt-1 text-2xl font-bold">{totals.totalCalled}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Ready to Ship</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {totals.readyToShip}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">No Answer</p>
          <p className="mt-1 text-2xl font-bold">{totals.noAnswer}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Phone Off</p>
          <p className="mt-1 text-2xl font-bold">{totals.phoneOff}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Stock Out</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">
            {totals.stockOut}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Cancelled</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {totals.cancelled}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {totals.pending}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Agent Wise Live Performance
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Called At between {from} and {to} (Bangladesh time). Current order
            status is used for outcome totals.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3 text-center">Total Called</th>
                <th className="px-5 py-3 text-center">Ready</th>
                <th className="px-5 py-3 text-center">No Answer</th>
                <th className="px-5 py-3 text-center">Phone Off</th>
                <th className="px-5 py-3 text-center">Stock Out</th>
                <th className="px-5 py-3 text-center">Cancelled</th>
                <th className="px-5 py-3 text-center">Pending</th>
                <th className="px-5 py-3 text-center">Conversion</th>
              </tr>
            </thead>

            <tbody>
              {agentRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">@{row.username}</p>
                  </td>
                  <td className="px-5 py-4 text-center font-semibold">
                    {row.totalCalled}
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-emerald-600">
                    {row.readyToShip}
                  </td>
                  <td className="px-5 py-4 text-center">{row.noAnswer}</td>
                  <td className="px-5 py-4 text-center">{row.phoneOff}</td>
                  <td className="px-5 py-4 text-center text-violet-600">
                    {row.stockOut}
                  </td>
                  <td className="px-5 py-4 text-center text-red-600">
                    {row.cancelled}
                  </td>
                  <td className="px-5 py-4 text-center text-amber-600">
                    {row.pending}
                  </td>
                  <td className="px-5 py-4 text-center font-bold">
                    {percent(row.readyToShip, row.totalCalled)}
                  </td>
                </tr>
              ))}

              {!agentRows.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No calls were submitted in the selected Called At date
                    range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Important:</strong> this report does not use order import date.
        An order is counted on the Bangladesh calendar date/time stored in{" "}
        <code>calledAt</code>. This matches the “Called at” timestamp shown on
        the Calling Panel.
      </section>
    </div>
  );
}
