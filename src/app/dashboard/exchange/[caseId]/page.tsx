import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";
import ExchangeVerifyButton from "./exchange-verify-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALL_EXCHANGE_ROLES = [
  "ADMIN",
  "AGENT",
  "NOTE_AGENT",
  "PACKAGING_AGENT",
];

type Props = { params: Promise<{ caseId: string }> };

export default async function ExchangeCasePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !ALL_EXCHANGE_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { caseId } = await params;
  const { prisma } = await import("@/lib/prisma");
  const exchange = await prisma.exchangeCase.findUnique({
    where: { id: caseId },
    include: {
      originalOrder: {
        include: { items: true, pathaoCourier: { select: { name: true } } },
      },
      exchangeOrder: {
        include: { items: true, pathaoCourier: { select: { name: true } } },
      },
      createdByUser: { select: { name: true, username: true } },
      items: true,
    },
  });

  if (!exchange) notFound();

  const expected = exchange.items.filter((item) => item.kind === "EXPECTED_RETURN");
  const outgoing = exchange.items.filter((item) => item.kind === "OUTGOING");
  const expectedOrderItemIds = expected
    .map((item) => item.originalOrderItemId)
    .filter((value): value is string => Boolean(value));

  const returnedRows = expectedOrderItemIds.length
    ? await prisma.pathaoReturnItem.groupBy({
        by: ["orderItemId"],
        where: {
          orderItemId: { in: expectedOrderItemIds },
          createdAt: { gte: exchange.createdAt },
        },
        _sum: { returnedQty: true },
      })
    : [];
  const receivedMap = new Map(
    returnedRows.map((row) => [row.orderItemId, Number(row._sum.returnedQty || 0)])
  );

  const expectedTotal = expected.reduce((sum, item) => sum + item.quantity, 0);
  const receivedTotal = expected.reduce(
    (sum, item) =>
      sum +
      Math.min(
        item.quantity,
        item.originalOrderItemId
          ? receivedMap.get(item.originalOrderItemId) || 0
          : 0
      ),
    0
  );
  const returnLabel =
    expectedTotal === 0
      ? "Not Required"
      : receivedTotal >= expectedTotal
      ? "Received"
      : receivedTotal > 0
      ? "Partial"
      : "Pending";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/dashboard/exchange"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Exchange Panel
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{exchange.exchangeCode}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Created by {exchange.createdByUser.name || exchange.createdByUser.username} · {formatBangladeshDateTime(exchange.createdAt)}
            </p>
          </div>
          <ExchangeVerifyButton caseId={exchange.id} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Exchange Status</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{exchange.status}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pathao Verification</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{exchange.verificationStatus}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Physical Return</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{returnLabel}</p>
          <p className="text-xs text-slate-500">{receivedTotal} / {expectedTotal} pcs received</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Amount To Collect</p>
          <p className="mt-2 text-lg font-bold text-emerald-700">Tk {Number(exchange.amountToCollect).toFixed(2)}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Original Order</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p><b>Invoice:</b> {exchange.originalOrder.invoiceId}</p>
            <p><b>Customer:</b> {exchange.originalOrder.customerName} · {exchange.originalOrder.phone}</p>
            <p><b>Address:</b> {exchange.originalOrder.address}</p>
            <p><b>OMS Status:</b> {exchange.originalOrder.orderStatus}</p>
            <p><b>Pathao CID:</b> {exchange.originalPathaoConsignmentId || exchange.originalOrder.pathaoConsignmentId || "N/A"}</p>
            <p><b>Pathao:</b> {exchange.originalOrder.pathaoOrderStatus || exchange.originalOrder.pathaoOrderStatusSlug || "N/A"}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {exchange.originalOrder.pathaoConsignmentId ? (
              <a
                href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(exchange.originalOrder.pathaoConsignmentId)}?isShowingActive=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Original in Pathao <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Exchange Memo</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p><b>Memo:</b> {exchange.exchangeOrder.invoiceId}</p>
            <p><b>OMS Status:</b> {exchange.exchangeOrder.orderStatus}</p>
            <p><b>Invoice:</b> {exchange.exchangeOrder.invoiceDownloaded ? "Downloaded" : "Non Invoiced"}</p>
            <p><b>CSV:</b> {exchange.exchangeOrder.csvDownloaded ? "Downloaded" : "Not Downloaded"}</p>
            <p><b>Pathao Exchange CID:</b> {exchange.pathaoExchangeConsignmentId}</p>
            <p><b>Pathao:</b> {exchange.pathaoOrderStatus || exchange.pathaoOrderStatusSlug || exchange.exchangeOrder.pathaoOrderStatus || "Waiting for webhook"}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["ADMIN", "PACKAGING_AGENT"].includes(session.user.role) ? (
              <Link
                href="/dashboard/ready-to-ship?tab=non-invoiced"
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Ready to Ship
              </Link>
            ) : null}
            <a
              href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(exchange.pathaoExchangeConsignmentId)}?isShowingActive=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Exchange in Pathao <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Expected Back From Customer</h2>
          <div className="mt-4 space-y-3">
            {expected.map((item) => {
              const received = Math.min(
                item.quantity,
                item.originalOrderItemId
                  ? receivedMap.get(item.originalOrderItemId) || 0
                  : 0
              );
              return (
                <div key={item.id} className="rounded-xl border bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.productSkuSnapshot} - {item.productNameSnapshot}</p>
                  <p className="mt-1 text-slate-600">Expected {item.quantity} · Received {received} · Tk {Number(item.lineTotal).toFixed(2)} credit</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            Stock is restored only through Pathao Return Track when the old product physically reaches the office.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Products To Send</h2>
          <div className="mt-4 space-y-3">
            {outgoing.map((item) => (
              <div key={item.id} className="rounded-xl border bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{item.productSkuSnapshot} - {item.productNameSnapshot}</p>
                <p className="mt-1 text-slate-600">{item.quantity} × Tk {Number(item.unitPrice).toFixed(2)} = Tk {Number(item.lineTotal).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Financial Summary</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Returned Credit</span><b className="mt-1 block">Tk {Number(exchange.returnedCredit).toFixed(2)}</b></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Outgoing</span><b className="mt-1 block">Tk {Number(exchange.outgoingSubtotal).toFixed(2)}</b></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Price Difference</span><b className="mt-1 block">Tk {Number(exchange.priceDifference).toFixed(2)}</b></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Delivery</span><b className="mt-1 block">Tk {Number(exchange.exchangeDeliveryCharge).toFixed(2)}</b></div>
          <div className="rounded-xl bg-emerald-50 p-3 text-sm"><span className="text-emerald-700">Collect</span><b className="mt-1 block text-emerald-800">Tk {Number(exchange.amountToCollect).toFixed(2)}</b></div>
          <div className="rounded-xl bg-amber-50 p-3 text-sm"><span className="text-amber-700">Customer Credit</span><b className="mt-1 block text-amber-800">Tk {Number(exchange.customerCredit).toFixed(2)}</b></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase text-slate-500">Reason</p><p className="mt-1 text-sm text-slate-800">{exchange.reason || "N/A"}</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Note</p><p className="mt-1 text-sm text-slate-800">{exchange.note || "N/A"}</p></div>
        </div>
        {exchange.verificationMessage ? (
          <div className="mt-5 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
            <b>Verification:</b> {exchange.verificationMessage}
          </div>
        ) : null}
      </section>
    </div>
  );
}
