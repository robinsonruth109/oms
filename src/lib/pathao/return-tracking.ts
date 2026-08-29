import { prisma } from "@/lib/prisma";
import { getPathaoOrderInfo } from "./client";
import type { PathaoOrderInfo } from "./types";

export type PathaoReturnCourierMatch = {
  courierId: string;
  courierName: string;
  courierSlug: string;
  merchantOrderId: string;
  pathaoStatus: string | null;
  pathaoStatusSlug: string | null;
  info: PathaoOrderInfo;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown Pathao error");
}

export function pathaoMerchantOrderId(info: PathaoOrderInfo) {
  return cleanText(info.merchant_order_id) || cleanText(info.invoice_id);
}

export function pathaoStatusLabel(info: PathaoOrderInfo) {
  return cleanText(info.order_status) || cleanText(info.order_status_slug);
}

export async function searchAllPathaoCouriersForConsignment(
  consignmentId: string
) {
  const couriers = await prisma.courier.findMany({
    where: {
      status: true,
      pathaoEnabled: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const results = await Promise.all(
    couriers.map(async (courier) => {
      try {
        const info = await getPathaoOrderInfo(courier.id, consignmentId);
        const merchantOrderId = pathaoMerchantOrderId(info);

        if (!merchantOrderId) {
          return {
            type: "EMPTY" as const,
            courier,
          };
        }

        return {
          type: "MATCH" as const,
          match: {
            courierId: courier.id,
            courierName: courier.name,
            courierSlug: courier.slug,
            merchantOrderId,
            pathaoStatus: cleanText(info.order_status),
            pathaoStatusSlug: cleanText(info.order_status_slug),
            info,
          } satisfies PathaoReturnCourierMatch,
        };
      } catch (error) {
        return {
          type: "ERROR" as const,
          courier,
          error: errorText(error),
        };
      }
    })
  );

  const matches: PathaoReturnCourierMatch[] = [];
  const errors: { courierId: string; courierName: string; message: string }[] = [];

  for (const result of results) {
    if (result.type === "MATCH") {
      matches.push(result.match);
    } else if (result.type === "ERROR") {
      errors.push({
        courierId: result.courier.id,
        courierName: result.courier.name,
        message: result.error,
      });
    }
  }

  return {
    checkedCourierCount: couriers.length,
    matches,
    errors,
  };
}
