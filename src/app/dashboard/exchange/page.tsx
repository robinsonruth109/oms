import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowRightLeft, ExternalLink } from "lucide-react";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDate,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import { normalizeBangladeshPhone } from "@/lib/phone-normalization";
import ExchangePanelClient, {
  type ExchangeSearchOrder,
} from "./exchange-panel-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALL_EXCHANGE_ROLES = [
  "ADMIN",
  "AGENT",
  "NOTE_AGENT",
  "PACKAGING_AGENT",
];

type Props = {
  searchParams?: Promise<{
    q?: string;
    historyDate?: string;
    status?: string;
  }>;
};

function normalizeSearch(value: string) {
  return String(value || "").trim();
}

function statusBadge(status: string) {
  if (status === "PATHAO_EXCHANGED") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "CANCELLED") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

function verificationBadge(status: string) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-800";
  if (status === "FAILED") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export default async function ExchangePage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session || !ALL_EXCHANGE_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const q = normalizeSearch(params.q || "");
  const today = getBangladeshDateInputValue();
  const historyDate = String(params.historyDate || today).trim();
  const historyStatus = String(params.status || "").trim();

  const products = await prisma.product.findMany({
    where: { status: true },
    include: { parent: { select: { sku: true } } },
    orderBy: [{ sku: "asc" }, { createdAt: "desc" }],
  });

  const productBySku = new Map(products.map((product) => [product.sku, product]));

  let searchResults: ExchangeSearchOrder[] = [];
  if (q) {
    const normalizedPhone = normalizeBangladeshPhone(q);
    const phoneTail = normalizedPhone.length >= 10 ? normalizedPhone.slice(-10) : "";

    const orders = await prisma.order.findMany({
      where: {
        orderKind: "NORMAL",
        OR: [
          { invoiceId: q },
          { orderId: q },
          { externalOrderId: q },
          { pathaoMerchantOrderId: q },
          { invoiceId: { contains: q } },
          ...(normalizedPhone
            ? [
                { phone: normalizedPhone },
                { phone: `88${normalizedPhone}` },
                { phone: `+88${normalizedPhone}` },
              ]
            : []),
          ...(phoneTail ? [{ phone: { endsWith: phoneTail } }] : []),
        ],
      },
      include: {
        source: { select: { name: true } },
        page: { select: { name: true } },
        pathaoCourier: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    searchResults = orders
      .filter((order) => Boolean(order.invoiceId))
      .map((order) => ({
        id: order.id,
        invoiceId: order.invoiceId || order.orderId || order.id,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        createdAt: formatBangladeshDate(order.createdAt),
        orderStatus: order.orderStatus,
        sourceName: order.source.name,
        pageName: order.page?.name || null,
        courierName: order.courier,
        pathaoConsignmentId: order.pathaoConsignmentId,
        pathaoStatus: order.pathaoOrderStatus,
        pathaoStatusSlug: order.pathaoOrderStatusSlug,
        pathaoCourierName: order.pathaoCourier?.name || null,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          resolvedProductId:
            item.productId || productBySku.get(item.productSku)?.id || null,
          productSku: item.productSku,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      }));
  }

  const historyWhere: any = {
    ...(historyDate
      ? {
          createdAt: {
            gte: bangladeshDateStartUtc(historyDate),
            lte: bangladeshDateEndUtc(historyDate),
          },
        }
      : {}),
    ...(historyStatus && ["ISSUED", "PATHAO_EXCHANGED", "CANCELLED"].includes(historyStatus)
      ? { status: historyStatus as "ISSUED" | "PATHAO_EXCHANGED" | "CANCELLED" }
      : {}),
  };

  const [history, todayTotal, todayCompleted, todayPendingVerify] =
    await Promise.all([
      prisma.exchangeCase.findMany({
        where: historyWhere,
        include: {
          originalOrder: {
            select: {
              invoiceId: true,
              customerName: true,
              phone: true,
            },
          },
          exchangeOrder: {
            select: {
              id: true,
              invoiceId: true,
              orderStatus: true,
              invoiceDownloaded: true,
              csvDownloaded: true,
              pathaoConsignmentId: true,
            },
          },
          createdByUser: { select: { name: true, username: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.exchangeCase.count({
        where: {
          createdAt: {
            gte: bangladeshDateStartUtc(today),
            lte: bangladeshDateEndUtc(today),
          },
        },
      }),
      prisma.exchangeCase.count({
        where: {
          status: "PATHAO_EXCHANGED",
          createdAt: {
            gte: bangladeshDateStartUtc(today),
            lte: bangladeshDateEndUtc(today),
          },
        },
      }),
      prisma.exchangeCase.count({
        where: {
          verificationStatus: "PENDING",
          createdAt: {
            gte: bangladeshDateStartUtc(today),
            lte: bangladeshDateEndUtc(today),
          },
        },
      }),
    ]);

  const expectedTodayQty = history
    .filter((row) => historyDate === today)
    .flatMap((row) => row.items)
    .filter((item) => item.kind === "EXPECTED_RETURN")
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">Exchange Panel</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Create the exchange in Pathao first, then create a linked OMS exchange memo without changing the historical original order.
            </p>
          </div>
          <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Exchange memos are created as <b>READY_TO_SHIP + Non Invoiced + CSV Downloaded</b>. OMS will never submit them to Pathao a second time.
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Exchanges Today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{todayTotal}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pathao Exchanged</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{todayCompleted}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending Verification</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{todayPendingVerify}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Expected Return Qty</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{expectedTodayQty}</p>
        </div>
      </section>

      <ExchangePanelClient
        searchQuery={q}
        searchResults={searchResults}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          parentSku: product.parent.sku,
          sellingPrice: Number(product.sellingPrice),
        }))}
      />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Exchange History</h2>
              <p className="mt-1 text-sm text-slate-500">
                Track issued exchange memos, Pathao state and expected return products.
              </p>
            </div>
            <form className="flex flex-wrap items-end gap-3">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Date
                <input
                  name="historyDate"
                  type="date"
                  defaultValue={historyDate}
                  className="block min-h-10 rounded-xl border px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Status
                <select
                  name="status"
                  defaultValue={historyStatus}
                  className="block min-h-10 rounded-xl border px-3 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="ISSUED">Issued</option>
                  <option value="PATHAO_EXCHANGED">Pathao Exchanged</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <button className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                Filter
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Exchange</th>
                <th className="px-5 py-3">Original</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Exchange CID</th>
                <th className="px-5 py-3">Expected Back</th>
                <th className="px-5 py-3">Outgoing</th>
                <th className="px-5 py-3">Collect</th>
                <th className="px-5 py-3">OMS Memo</th>
                <th className="px-5 py-3">Pathao</th>
                <th className="px-5 py-3">Agent / Date</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row) => {
                  const expected = row.items.filter(
                    (item) => item.kind === "EXPECTED_RETURN"
                  );
                  const outgoing = row.items.filter(
                    (item) => item.kind === "OUTGOING"
                  );
                  return (
                    <tr key={row.id} className="border-t align-top text-sm">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{row.exchangeCode}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadge(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {row.originalOrder.invoiceId}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{row.originalOrder.customerName}</p>
                        <p className="text-slate-500">{row.originalOrder.phone}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{row.pathaoExchangeConsignmentId}</p>
                        {row.pathaoCourierNameSnapshot ? (
                          <p className="mt-1 text-xs text-slate-500">{row.pathaoCourierNameSnapshot}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-700">
                        {expected.map((item) => (
                          <div key={item.id}>{item.productSkuSnapshot} × {item.quantity}</div>
                        ))}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-700">
                        {outgoing.map((item) => (
                          <div key={item.id}>{item.productSkuSnapshot} × {item.quantity}</div>
                        ))}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        Tk {Number(row.amountToCollect).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <p className="font-semibold text-slate-800">{row.exchangeOrder.orderStatus}</p>
                        <p className="mt-1 text-slate-500">
                          Invoice: {row.exchangeOrder.invoiceDownloaded ? "Downloaded" : "Non Invoiced"}
                        </p>
                        <p className="text-slate-500">
                          CSV: {row.exchangeOrder.csvDownloaded ? "Downloaded" : "Not Downloaded"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span className={`inline-flex rounded-full px-2.5 py-1 font-bold ${verificationBadge(row.verificationStatus)}`}>
                          {row.verificationStatus}
                        </span>
                        <p className="mt-2 max-w-52 text-slate-600">
                          {row.pathaoOrderStatus || row.pathaoOrderStatusSlug || "Waiting for Pathao"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">
                          {row.createdByUser.name || row.createdByUser.username}
                        </p>
                        <p className="mt-1">{formatBangladeshDateTime(row.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/dashboard/exchange/${row.id}`}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white"
                          >
                            View
                          </Link>
                          <a
                            href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(row.pathaoExchangeConsignmentId)}?isShowingActive=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Pathao <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-sm text-slate-500">
                    No exchange cases for this filter.
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
