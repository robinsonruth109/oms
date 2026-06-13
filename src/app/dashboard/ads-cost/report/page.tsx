export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    sourceId?: string;
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

function money(value: number) {
  return `৳ ${Number(value || 0).toFixed(2)}`;
}

function usd(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

export default async function AdsCostReportPage({
  searchParams,
}: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const today = getLocalDateInputValue();

  const from = (params.from || today).trim();
  const to = (params.to || today).trim();
  const sourceId = (params.sourceId || "").trim();

  const fromDate = startOfDay(from);
  const toDate = endOfDay(to);

  const sources = await prisma.orderSource.findMany({
  where: { status: true },
  orderBy: { name: "asc" },
  select: {
    id: true,
    name: true,
    type: true,
  },
});

const adsItems = await prisma.adsCostItem.findMany({
  where: {
    ...(sourceId ? { sourceId } : {}),
    upload: {
      uploadDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
  },
  include: {
    productParent: true,
    source: true,
    upload: true,
  },
  orderBy: {
    createdAt: "desc",
  },
});

const readyItems = await prisma.orderItem.findMany({
  where: {
    order: {
      orderStatus: "READY_TO_SHIP",
      readyToShipAt: {
        gte: fromDate,
        lte: toDate,
      },
      ...(sourceId ? { sourceId } : {}),
    },
  },
  include: {
    product: {
      include: {
        parent: true,
      },
    },
    order: {
      select: {
        sourceId: true,
      },
    },
  },
});

const receivedOrders = await prisma.purchaseReceivedOrder.findMany({
  where: {
    receiveDate: {
      lte: toDate,
    },
  },
  include: {
    purchaseOrder: true,
  },
});

const products = await prisma.product.findMany({
  where: { status: true },
  include: {
    parent: true,
  },
});

const dollarRates = await prisma.dailyDollarRate.findMany({
  where: {
    rateDate: {
      gte: fromDate,
      lte: toDate,
    },
  },
});

  const dollarRateMap = new Map<
    string,
    {
      totalUsd: number;
      totalBdt: number;
      averageRate: number;
    }
  >();

  for (const rate of dollarRates) {
    const dateKey = getLocalDateInputValue(rate.rateDate);

    const current = dollarRateMap.get(dateKey) || {
      totalUsd: 0,
      totalBdt: 0,
      averageRate: 0,
    };

    current.totalUsd += Number(rate.usdAmount);
    current.totalBdt += Number(rate.bdtAmount);

    current.averageRate =
      current.totalUsd > 0 ? current.totalBdt / current.totalUsd : 0;

    dollarRateMap.set(dateKey, current);
  }

  const originalCostMap = new Map<
    string,
    {
      totalQty: number;
      totalCost: number;
    }
  >();

  for (const received of receivedOrders) {
    const parentSku = received.purchaseOrder.parentSku;

    const current = originalCostMap.get(parentSku) || {
      totalQty: 0,
      totalCost: 0,
    };

    current.totalQty += Number(received.receivedQty);
    current.totalCost += Number(received.grandTotalBdt);

    originalCostMap.set(parentSku, current);
  }

  const fallbackPriceMap = new Map<
    string,
    {
      totalQty: number;
      totalPrice: number;
    }
  >();

  for (const product of products) {
    const parentSku = product.parent.sku;

    const current = fallbackPriceMap.get(parentSku) || {
      totalQty: 0,
      totalPrice: 0,
    };

    current.totalQty += Number(product.quantity || 1);
    current.totalPrice += Number(product.purchasePrice);

    fallbackPriceMap.set(parentSku, current);
  }

  const readyQtyMap = new Map<string, number>();

  for (const item of readyItems) {
    if (!item.product?.parent) continue;

    const parentId = item.product.parent.id;
    const sourceIdForOrder = item.order.sourceId;

    const key = `${parentId}__${sourceIdForOrder}`;

    const productQty = Number(item.product.quantity || 1);
    const orderQty = Number(item.quantity || 1);

    const finalQty = productQty * orderQty;

    readyQtyMap.set(key, (readyQtyMap.get(key) || 0) + finalQty);
  }

  const reportMap = new Map<
    string,
    {
      productParentId: string;
      parentSku: string;
      parentName: string;
      sourceId: string;
      sourceName: string;
      campaignName: string;
      adsSpentUsd: number;
      adsSpentBdt: number;
      dollarRate: number;
      readyQty: number;
      purchasePrice: number;
      cpoBdt: number;
    }
  >();

  for (const item of adsItems) {
    const uploadDateKey = getLocalDateInputValue(
      item.upload.uploadDate
    );

    const dollarRate =
      dollarRateMap.get(uploadDateKey)?.averageRate || 0;

    const adsSpentUsd = Number(item.amountSpent);

    const adsSpentBdt = adsSpentUsd * dollarRate;

    const key = `${item.productParentId}__${item.sourceId}__${item.campaignName}`;

    const readyKey = `${item.productParentId}__${item.sourceId}`;

    const readyQty = readyQtyMap.get(readyKey) || 0;

    const originalCost = originalCostMap.get(
      item.productParent.sku
    );

    const fallbackPrice = fallbackPriceMap.get(
      item.productParent.sku
    );

    const purchasePrice =
      originalCost && originalCost.totalQty > 0
        ? originalCost.totalCost / originalCost.totalQty
        : fallbackPrice && fallbackPrice.totalQty > 0
          ? fallbackPrice.totalPrice / fallbackPrice.totalQty
          : 0;

    const existing = reportMap.get(key);

    if (existing) {
      existing.adsSpentUsd += adsSpentUsd;
      existing.adsSpentBdt += adsSpentBdt;

      existing.cpoBdt =
        readyQty > 0
          ? existing.adsSpentBdt / readyQty
          : 0;
    } else {
      reportMap.set(key, {
        productParentId: item.productParentId,
        parentSku: item.productParent.sku,
        parentName: item.productParent.name,
        sourceId: item.sourceId,
        sourceName: item.source.name,
        campaignName: item.campaignName,
        adsSpentUsd,
        adsSpentBdt,
        dollarRate,
        readyQty,
        purchasePrice,
        cpoBdt:
          readyQty > 0
            ? adsSpentBdt / readyQty
            : 0,
      });
    }
  }

  const rows = Array.from(reportMap.values()).sort(
    (a, b) => b.adsSpentBdt - a.adsSpentBdt
  );

  const totalAdsUsd = rows.reduce(
    (sum, row) => sum + row.adsSpentUsd,
    0
  );

  const totalAdsBdt = rows.reduce(
    (sum, row) => sum + row.adsSpentBdt,
    0
  );

  const totalQty = rows.reduce(
    (sum, row) => sum + row.readyQty,
    0
  );

  const averageCpoBdt =
    totalQty > 0 ? totalAdsBdt / totalQty : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Ads Cost Report
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Campaign-wise ads cost report based on ready orders only.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              From Date
            </label>

            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              To Date
            </label>

            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Source
            </label>

            <select
              name="sourceId"
              defaultValue={sourceId}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Sources</option>

              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Summary
          title="Total Ads Spend USD"
          value={usd(totalAdsUsd)}
        />

        <Summary
          title="Total Ads Spend BDT"
          value={money(totalAdsBdt)}
        />

        <Summary
          title="Total Ready Qty"
          value={String(totalQty)}
        />

        <Summary
          title="Average CPO BDT"
          value={money(averageCpoBdt)}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Product Parent Wise Ads Report
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Product Parent Code</Th>
                <Th>Campaign Name</Th>
                <Th>Source</Th>
                <Th center>Qty</Th>
                <Th center>Product Purchase Price</Th>
                <Th center>Dollar Rate</Th>
                <Th center>Ads Spent USD</Th>
                <Th center>Ads Spent BDT</Th>
                <Th center>CPO BDT</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.productParentId}-${row.sourceId}-${row.campaignName}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-5 py-4 text-sm">
                    <p className="font-semibold text-slate-900">
                      {row.parentSku}
                    </p>

                    <p className="text-xs text-slate-500">
                      {row.parentName}
                    </p>
                  </td>

                  <Td>{row.campaignName}</Td>

                  <Td>{row.sourceName}</Td>

                  <Td center>{row.readyQty}</Td>

                  <Td center>
                    {money(row.purchasePrice)}
                  </Td>

                  <Td center>
                    {row.dollarRate > 0
                      ? money(row.dollarRate)
                      : "No Rate"}
                  </Td>

                  <Td center>
                    {usd(row.adsSpentUsd)}
                  </Td>

                  <Td center>
                    {money(row.adsSpentBdt)}
                  </Td>

                  <Td center>
                    {money(row.cpoBdt)}
                  </Td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No ads report data found for this filter.
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

function Summary({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-sm text-slate-700 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}