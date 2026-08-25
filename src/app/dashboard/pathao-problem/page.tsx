import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import PathaoProblemBulkSync from "./bulk-sync";
import {
  ClearCodAuthorizationButton,
  CodAuthorizationForm,
  RefreshPathaoProblemButton,
} from "./problem-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: Promise<{
    q?: string;
    date?: string;
    status?: string;
  }>;
};

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `৳${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function difference(a: unknown, b: unknown) {
  return Math.round((Number(a || 0) - Number(b || 0)) * 100) / 100;
}

function almostEqual(a: unknown, b: unknown) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;
}

export default async function PathaoProblemPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "NOTE_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const q = String(params.q || "").trim();
  const selectedDate = String(
    params.date || getBangladeshDateInputValue()
  ).trim();
  const statusFilter = String(params.status || "all").trim();

  const searchOrder = q
    ? await prisma.order.findFirst({
        where: {
          OR: [
            { invoiceId: { contains: q } },
            { orderId: { contains: q } },
            { externalOrderId: { contains: q } },
            { phone: { contains: q } },
            { pathaoConsignmentId: { contains: q } },
            { pathaoMerchantOrderId: { contains: q } },
          ],
        },
        include: {
          pathaoCourier: true,
          pathaoCodApprovedByUser: true,
          pathaoCodAuthorizations: {
            include: {
              approvedByUser: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  // Courier Amount Report:
  // Any Pathao parcel whose actual Amount to Collect differs from the original
  // OMS total belongs in this list, because it represents a COD discount/change.
  // We then classify whether the difference was authorized by OMS.
  const reportOrders = await prisma.order.findMany({
    where: {
      pathaoConsignmentId: { not: null },
      readyToShipAt: {
        gte: bangladeshDateStartUtc(selectedDate),
        lte: bangladeshDateEndUtc(selectedDate),
      },
    },
    include: {
      pathaoCourier: true,
      pathaoCodApprovedByUser: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const totalUnsyncedForDate = reportOrders.filter(
    (order) => order.pathaoAmountToCollect === null
  ).length;

  const reportRows = reportOrders
    .map((order) => {
      const original = Number(order.totalAmount);
      const authorized =
        order.pathaoAuthorizedCodAmount === null
          ? null
          : Number(order.pathaoAuthorizedCodAmount);
      const actual =
        order.pathaoAmountToCollect === null
          ? null
          : Number(order.pathaoAmountToCollect);

      let classification:
        | "GOOD"
        | "AUTHORIZED"
        | "UNAUTHORIZED"
        | "AUTHORIZED_MISMATCH"
        | "NEEDS_SYNC";

      if (actual === null) {
        classification = "NEEDS_SYNC";
      } else if (almostEqual(original, actual)) {
        classification = "GOOD";
      } else if (authorized !== null && almostEqual(authorized, actual)) {
        classification = "AUTHORIZED";
      } else if (authorized !== null) {
        classification = "AUTHORIZED_MISMATCH";
      } else {
        classification = "UNAUTHORIZED";
      }

      return { order, original, authorized, actual, classification };
    })
    .filter((row) => {
      // "Courier Amount Report" focuses on changed/problem amounts.
      if (row.classification === "GOOD") return false;

      if (statusFilter === "authorized") {
        return row.classification === "AUTHORIZED";
      }

      if (statusFilter === "problem") {
        return ["UNAUTHORIZED", "AUTHORIZED_MISMATCH"].includes(
          row.classification
        );
      }

      if (statusFilter === "sync") {
        return row.classification === "NEEDS_SYNC";
      }

      return true;
    });

  const authorizedCount = reportRows.filter(
    (row) => row.classification === "AUTHORIZED"
  ).length;
  const problemCount = reportRows.filter((row) =>
    ["UNAUTHORIZED", "AUTHORIZED_MISMATCH"].includes(row.classification)
  ).length;
  const needsSyncCount = reportRows.filter(
    (row) => row.classification === "NEEDS_SYNC"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Pathao Problem</h1>
        <p className="mt-1 text-sm text-slate-500">
          Authorize delivery-time COD changes and audit whether Pathao Amount to
          Collect matches the value approved inside OMS.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Search Order
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Phone / Invoice ID / Order ID / Consignment ID"
              className="w-full rounded-xl border px-3 py-2.5"
            />
          </label>

          <button className="self-end rounded-xl bg-slate-900 px-7 py-2.5 text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </section>

      {q && !searchOrder ? (
        <section className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No OMS order matched <strong>{q}</strong>.
        </section>
      ) : null}

      {searchOrder ? (
        <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                OMS Order
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {searchOrder.invoiceId ||
                  searchOrder.orderId ||
                  searchOrder.externalOrderId ||
                  searchOrder.id}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {searchOrder.customerName} · {searchOrder.phone}
              </p>
            </div>

            {searchOrder.pathaoConsignmentId ? (
              <a
                href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(
                  searchOrder.pathaoConsignmentId
                )}?isShowingActive=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open in Pathao
              </a>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-400">
                Original OMS Total
              </p>
              <p className="mt-2 text-2xl font-bold">
                {money(searchOrder.totalAmount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                This value is never overwritten.
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs uppercase text-amber-600">
                Authorized COD
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {searchOrder.pathaoAuthorizedCodAmount === null
                  ? "Not authorized"
                  : money(searchOrder.pathaoAuthorizedCodAmount)}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Expected Pathao COD:{" "}
                {money(
                  searchOrder.pathaoAuthorizedCodAmount ??
                    searchOrder.totalAmount
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-xs uppercase text-blue-600">
                Pathao Amount to Collect
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-900">
                {searchOrder.pathaoAmountToCollect === null
                  ? "Not synced"
                  : money(searchOrder.pathaoAmountToCollect)}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Last sync:{" "}
                {formatBangladeshDateTime(searchOrder.pathaoLastSyncedAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-400">Pathao Parcel</p>
              <p className="mt-2 font-bold">
                {searchOrder.pathaoConsignmentId || "No consignment ID"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {searchOrder.pathaoOrderStatus ||
                  searchOrder.pathaoOrderStatusSlug ||
                  searchOrder.pathaoSubmissionStatus}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border p-5">
              <h3 className="font-semibold">Pathao Sync</h3>
              <p className="mt-1 text-sm text-slate-500">
                Refresh before approving and after making the change in Pathao.
              </p>
              <div className="mt-4">
                <RefreshPathaoProblemButton orderId={searchOrder.id} />
              </div>

              {searchOrder.pathaoLastError ? (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {searchOrder.pathaoLastError}
                </div>
              ) : null}

              <div className="mt-5 space-y-2 text-sm">
                <p>
                  <strong>Courier:</strong>{" "}
                  {searchOrder.pathaoCourier?.name ||
                    searchOrder.courier ||
                    "N/A"}
                </p>
                <p>
                  <strong>Address:</strong> {searchOrder.address}
                </p>
                <p>
                  <strong>Products:</strong>{" "}
                  {searchOrder.items
                    .map(
                      (item) =>
                        `${item.productSku || item.productName} × ${
                          item.quantity
                        }`
                    )
                    .join(", ")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <h3 className="font-semibold">Authorize COD Change</h3>
              <p className="mt-1 text-sm text-slate-500">
                This records permission inside OMS. The agent then uses Open in
                Pathao to change the courier Amount to Collect.
              </p>

              <div className="mt-4">
                <CodAuthorizationForm
                  orderId={searchOrder.id}
                  currentAmount={Number(
                    searchOrder.pathaoAuthorizedCodAmount ??
                      searchOrder.totalAmount
                  )}
                />
              </div>

              {searchOrder.pathaoAuthorizedCodAmount !== null ? (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p>
                    <strong>Current authorization:</strong>{" "}
                    {money(searchOrder.pathaoAuthorizedCodAmount)}
                  </p>
                  <p className="mt-1">
                    <strong>Reason:</strong>{" "}
                    {searchOrder.pathaoCodAdjustmentReason || "N/A"}
                  </p>
                  <p className="mt-1">
                    <strong>Approved by:</strong>{" "}
                    {searchOrder.pathaoCodApprovedByUser?.name || "N/A"} ·{" "}
                    {formatBangladeshDateTime(
                      searchOrder.pathaoCodApprovedAt
                    )}
                  </p>

                  <div className="mt-3">
                    <ClearCodAuthorizationButton orderId={searchOrder.id} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">COD Authorization History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Original</th>
                    <th className="px-5 py-3">Previous Approved</th>
                    <th className="px-5 py-3">New Approved</th>
                    <th className="px-5 py-3">Pathao at Approval</th>
                    <th className="px-5 py-3">Approved By</th>
                    <th className="px-5 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {searchOrder.pathaoCodAuthorizations.map((history) => (
                    <tr key={history.id} className="border-t">
                      <td className="px-5 py-3">
                        {formatBangladeshDateTime(history.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        {money(history.originalOmsTotal)}
                      </td>
                      <td className="px-5 py-3">
                        {history.previousAuthorizedAmount === null
                          ? "—"
                          : money(history.previousAuthorizedAmount)}
                      </td>
                      <td className="px-5 py-3 font-semibold">
                        {money(history.authorizedAmount)}
                      </td>
                      <td className="px-5 py-3">
                        {history.pathaoAmountAtApproval === null
                          ? "Not synced"
                          : money(history.pathaoAmountAtApproval)}
                      </td>
                      <td className="px-5 py-3">
                        {history.approvedByUser.name}
                      </td>
                      <td className="max-w-md px-5 py-3">{history.reason}</td>
                    </tr>
                  ))}
                  {!searchOrder.pathaoCodAuthorizations.length ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        No COD authorization history yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Courier Amount Report</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shows Pathao parcels where Amount to Collect is changed,
                unauthorized, mismatched with an authorization, or still needs
                an amount sync.
              </p>
            </div>

            <form className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="q" value={q} />
              <label className="text-sm">
                <span className="mb-1 block font-medium">Ready to Ship Date</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={selectedDate}
                  className="rounded-xl border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Result</span>
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="rounded-xl border px-3 py-2"
                >
                  <option value="all">All Changed / Problems</option>
                  <option value="authorized">Authorized</option>
                  <option value="problem">Unauthorized / Mismatch</option>
                  <option value="sync">Needs Sync</option>
                </select>
              </label>
              <button className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
                Apply
              </button>
            </form>
          </div>
        </div>

        <div className="border-b p-5">
          <PathaoProblemBulkSync
            selectedDate={selectedDate}
            initialUnsynced={totalUnsyncedForDate}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 border-b bg-slate-50 p-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-slate-500">Authorized Discounts</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {authorizedCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-slate-500">Unauthorized / Mismatch</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {problemCount}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-sm text-slate-500">Needs Amount Sync</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {needsSyncCount}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Consignment</th>
                <th className="px-4 py-3">OMS Total</th>
                <th className="px-4 py-3">Authorized COD</th>
                <th className="px-4 py-3">Pathao Amount</th>
                <th className="px-4 py-3">Difference</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map(
                ({ order, original, authorized, actual, classification }) => {
                  const expected = authorized ?? original;
                  const diff =
                    actual === null ? null : difference(actual, expected);

                  const resultStyle =
                    classification === "AUTHORIZED"
                      ? "bg-emerald-100 text-emerald-700"
                      : classification === "NEEDS_SYNC"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700";

                  const resultLabel =
                    classification === "AUTHORIZED"
                      ? "AUTHORIZED"
                      : classification === "NEEDS_SYNC"
                      ? "NEEDS SYNC"
                      : classification === "AUTHORIZED_MISMATCH"
                      ? "AUTHORIZED BUT PATHAO MISMATCH"
                      : "UNAUTHORIZED DIFFERENCE";

                  return (
                    <tr key={order.id} className="border-t align-top">
                      <td className="px-4 py-4 font-semibold">
                        {order.invoiceId ||
                          order.orderId ||
                          order.externalOrderId ||
                          order.id}
                      </td>
                      <td className="px-4 py-4">
                        <p>{order.customerName}</p>
                        <p className="text-xs text-slate-500">{order.phone}</p>
                      </td>
                      <td className="px-4 py-4">
                        {order.pathaoConsignmentId}
                      </td>
                      <td className="px-4 py-4">{money(original)}</td>
                      <td className="px-4 py-4">
                        {authorized === null ? "—" : money(authorized)}
                      </td>
                      <td className="px-4 py-4">
                        {actual === null ? "Not synced" : money(actual)}
                      </td>
                      <td
                        className={`px-4 py-4 font-semibold ${
                          diff !== null && Math.abs(diff) >= 0.01
                            ? "text-red-600"
                            : "text-slate-700"
                        }`}
                      >
                        {diff === null ? "—" : money(diff)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resultStyle}`}
                        >
                          {resultLabel}
                        </span>
                        {order.pathaoCodAdjustmentReason ? (
                          <p className="mt-2 max-w-xs text-xs text-slate-500">
                            {order.pathaoCodAdjustmentReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {order.pathaoCodApprovedByUser?.name || "—"}
                        {order.pathaoCodApprovedAt ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {formatBangladeshDateTime(
                              order.pathaoCodApprovedAt
                            )}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-36 flex-col gap-2">
                          <a
                            href={`/dashboard/pathao-problem?q=${encodeURIComponent(
                              order.invoiceId ||
                                order.orderId ||
                                order.pathaoConsignmentId ||
                                ""
                            )}&date=${encodeURIComponent(selectedDate)}`}
                            className="rounded-xl border px-3 py-2 text-center text-xs font-semibold"
                          >
                            View Details
                          </a>
                          <a
                            href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(
                              order.pathaoConsignmentId || ""
                            )}?isShowingActive=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl bg-red-600 px-3 py-2 text-center text-xs font-semibold text-white"
                          >
                            Open in Pathao
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {!reportRows.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No courier amount changes/problems for this Ready to Ship
                    date.
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
