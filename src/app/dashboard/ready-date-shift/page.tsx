import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  bangladeshDateEndUtc,
  bangladeshDateStartUtc,
  formatBangladeshDateTime,
  getBangladeshDateInputValue,
} from "@/lib/bangladesh-time";
import ReadyDateShiftClient from "./ready-date-shift-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    date?: string;
    courier?: string;
  }>;
};

function safeDate(value: string | undefined, fallback: string) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

export default async function ReadyDateShiftPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { prisma } = await import("@/lib/prisma");
  const params = (await searchParams) || {};
  const today = getBangladeshDateInputValue();
  const sourceDate = safeDate(params.date, today);
  const courier = String(params.courier || "").trim();

  const [couriers, orders, eligibleCount, shiftLogs] = await Promise.all([
    prisma.courier.findMany({
      where: { status: true },
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
      },
    }),
    prisma.order.findMany({
      where: {
        orderStatus: "READY_TO_SHIP",
        invoiceDownloaded: false,
        readyToShipAt: {
          gte: bangladeshDateStartUtc(sourceDate),
          lte: bangladeshDateEndUtc(sourceDate),
        },
        ...(courier ? { courier } : {}),
      },
      include: {
        items: {
          select: {
            productSku: true,
            productName: true,
            quantity: true,
          },
        },
      },
      orderBy: [{ readyToShipAt: "asc" }, { createdAt: "asc" }],
      take: 2000,
    }),
    prisma.order.count({
      where: {
        orderStatus: "READY_TO_SHIP",
        invoiceDownloaded: false,
        readyToShipAt: {
          gte: bangladeshDateStartUtc(sourceDate),
          lte: bangladeshDateEndUtc(sourceDate),
        },
        ...(courier ? { courier } : {}),
      },
    }),
    prisma.readyToShipDateShift.findMany({
      include: {
        performedByUser: {
          select: {
            name: true,
            username: true,
            role: true,
          },
        },
        items: {
          take: 12,
          select: {
            invoiceIdSnapshot: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const courierMap = Object.fromEntries(
    couriers.map((courierRow) => [courierRow.slug, courierRow.name])
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Ready to Ship Date Shift
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Move non-invoiced Ready to Ship orders to another Bangladesh business
          date using a date filter or a CSV invoice list.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="date" className="text-sm font-medium text-slate-700">
              Ready to Ship Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={sourceDate}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="courier"
              className="text-sm font-medium text-slate-700"
            >
              Courier
            </label>
            <select
              id="courier"
              name="courier"
              defaultValue={courier}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All Couriers</option>
              {couriers.map((courierRow) => (
                <option key={courierRow.slug} value={courierRow.slug}>
                  {courierRow.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Load Non-Invoiced Orders
            </button>
          </div>
        </form>
      </section>

      <ReadyDateShiftClient
        sourceDate={sourceDate}
        selectedCourier={courier}
        eligibleCount={eligibleCount}
        courierMap={courierMap}
        manualOrders={orders.map((order) => ({
          id: order.id,
          invoiceId: order.invoiceId,
          customerName: order.customerName,
          phone: order.phone,
          courier: order.courier,
          totalAmount: Number(order.totalAmount),
          readyToShipDate: getBangladeshDateInputValue(order.readyToShipAt),
          items: order.items.map((item) => ({
            sku: item.productSku,
            name: item.productName,
            quantity: item.quantity,
          })),
        }))}
        shiftLogs={shiftLogs.map((log) => ({
          id: log.id,
          sourceDate: log.sourceDate,
          targetDate: log.targetDate,
          method: log.method,
          totalOrders: log.totalOrders,
          uploadedFileName: log.uploadedFileName,
          performedByName:
            log.performedByUser.name || log.performedByUser.username,
          performedByRole: log.performedByUser.role,
          createdAt: formatBangladeshDateTime(log.createdAt),
          invoicePreview: log.items
            .map((item) => item.invoiceIdSnapshot)
            .filter((value): value is string => Boolean(value)),
        }))}
      />
    </div>
  );
}
