import DollarRatesClient from "./dollar-rates-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
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

export default async function DollarRatesPage({ searchParams }: PageProps) {
  const { prisma } = await import("@/lib/prisma");

  const params = (await searchParams) || {};
  const today = getLocalDateInputValue();

  const from = (params.from || today).trim();
  const to = (params.to || today).trim();

  const rates = await prisma.dailyDollarRate.findMany({
    where: {
      rateDate: {
        gte: startOfDay(from),
        lte: endOfDay(to),
      },
    },
    orderBy: {
      rateDate: "desc",
    },
  });

  const grouped = new Map<
    string,
    {
      date: string;
      totalUsd: number;
      totalBdt: number;
      averageRate: number;
      entries: {
        id: string;
        rateDate: string;
        usdAmount: number;
        bdtAmount: number;
        usdRate: number;
        note: string | null;
      }[];
    }
  >();

  for (const rate of rates) {
    const dateKey = getLocalDateInputValue(rate.rateDate);

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        date: dateKey,
        totalUsd: 0,
        totalBdt: 0,
        averageRate: 0,
        entries: [],
      });
    }

    const row = grouped.get(dateKey)!;

    row.totalUsd += Number(rate.usdAmount);
    row.totalBdt += Number(rate.bdtAmount);
    row.averageRate = row.totalUsd > 0 ? row.totalBdt / row.totalUsd : 0;

    row.entries.push({
      id: rate.id,
      rateDate: dateKey,
      usdAmount: Number(rate.usdAmount),
      bdtAmount: Number(rate.bdtAmount),
      usdRate: Number(rate.usdRate),
      note: rate.note,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Daily Dollar Rates
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add multiple dollar purchases in a day and use the weighted average rate for reports.
        </p>
      </section>

      <DollarRatesClient
        from={from}
        to={to}
        groupedRates={Array.from(grouped.values())}
      />
    </div>
  );
}