import { calculateSuccessRate } from "../risk";
import { withBangladeshCountryCode } from "../phone";
import type { CourierProvider, CourierStats } from "../types";

const REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function makeStats(
  provider: CourierProvider,
  total: number,
  delivered: number,
  returned: number
): CourierStats {
  const safeTotal = Math.max(0, Math.trunc(total || 0));
  const safeDelivered = Math.max(0, Math.min(safeTotal, Math.trunc(delivered || 0)));
  const safeReturned = Math.max(0, Math.min(safeTotal, Math.trunc(returned || 0)));

  return {
    provider,
    total: safeTotal,
    delivered: safeDelivered,
    returned: safeReturned,
    successRate: calculateSuccessRate(safeDelivered, safeTotal),
    available: true,
    error: null,
  };
}

function failedStats(provider: CourierProvider, message: string): CourierStats {
  return {
    provider,
    total: 0,
    delivered: 0,
    returned: 0,
    successRate: 0,
    available: false,
    error: message,
  };
}

export async function fetchPathaoCustomerStats(input: {
  username: string;
  password: string;
  phone: string;
}): Promise<CourierStats> {
  try {
    const loginResponse = await fetch("https://merchant.pathao.com/api/v1/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "OMS Courier Score/1.0",
      },
      body: JSON.stringify({ username: input.username, password: input.password }),
      signal: timeoutSignal(),
      cache: "no-store",
    });

    const loginData = (await loginResponse.json().catch(() => null)) as
      | { access_token?: unknown; message?: unknown }
      | null;

    const accessToken =
      typeof loginData?.access_token === "string" ? loginData.access_token.trim() : "";

    if (!loginResponse.ok || !accessToken) {
      return failedStats(
        "PATHAO",
        typeof loginData?.message === "string"
          ? loginData.message
          : `Pathao login failed: HTTP ${loginResponse.status}`
      );
    }

    const statsResponse = await fetch("https://merchant.pathao.com/api/v1/user/success", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "OMS Courier Score/1.0",
      },
      body: JSON.stringify({ phone: input.phone }),
      signal: timeoutSignal(),
      cache: "no-store",
    });

    const statsData = (await statsResponse.json().catch(() => null)) as
      | {
          data?: {
            customer?: {
              successful_delivery?: unknown;
              total_delivery?: unknown;
            };
          };
          message?: unknown;
        }
      | null;

    if (!statsResponse.ok || !statsData?.data?.customer) {
      return failedStats(
        "PATHAO",
        typeof statsData?.message === "string"
          ? statsData.message
          : `Pathao stats failed: HTTP ${statsResponse.status}`
      );
    }

    const total = Number(statsData.data.customer.total_delivery ?? 0);
    const delivered = Number(statsData.data.customer.successful_delivery ?? 0);
    return makeStats("PATHAO", total, delivered, Math.max(0, total - delivered));
  } catch (error) {
    return failedStats(
      "PATHAO",
      error instanceof Error ? error.message : "Pathao customer history failed."
    );
  }
}

export async function fetchSteadfastCustomerStats(input: {
  username: string;
  password: string;
  phone: string;
}): Promise<CourierStats> {
  try {
    const {
      createSteadfastSession,
      describeSteadfastAccessFailure,
      fetchSteadfastFraudStats,
    } = await import("./steadfast-session");

    const session = await createSteadfastSession({
      username: input.username,
      password: input.password,
    });

    const statsResponse = await fetchSteadfastFraudStats(session, input.phone);
    const contentType = statsResponse.headers.get("content-type") ?? "";

    if (!statsResponse.ok) {
      return failedStats("STEADFAST", describeSteadfastAccessFailure(statsResponse));
    }

    if (!contentType.toLowerCase().includes("json")) {
      return failedStats(
        "STEADFAST",
        "Steadfast customer-history response JSON ছিল না। Session may have been redirected or blocked."
      );
    }

    const data = (await statsResponse.json().catch(() => null)) as
      | { total_delivered?: unknown; total_cancelled?: unknown; message?: unknown }
      | null;

    if (!data) {
      return failedStats("STEADFAST", "Steadfast returned an invalid response.");
    }

    const delivered = Number(data.total_delivered ?? 0);
    const returned = Number(data.total_cancelled ?? 0);
    return makeStats("STEADFAST", delivered + returned, delivered, returned);
  } catch (error) {
    return failedStats(
      "STEADFAST",
      error instanceof Error ? error.message : "Steadfast customer history failed."
    );
  }
}

export async function fetchRedXCustomerStats(input: {
  username: string;
  password: string;
  phone: string;
}): Promise<CourierStats> {
  try {
    const loginResponse = await fetch("https://api.redx.com.bd/v4/auth/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "OMS Courier Score/1.0",
      },
      body: JSON.stringify({
        phone: withBangladeshCountryCode(input.username),
        password: input.password,
      }),
      signal: timeoutSignal(),
      cache: "no-store",
    });

    const loginData = (await loginResponse.json().catch(() => null)) as
      | { data?: { accessToken?: unknown }; message?: unknown }
      | null;

    const accessToken =
      typeof loginData?.data?.accessToken === "string"
        ? loginData.data.accessToken.trim()
        : "";

    if (!loginResponse.ok || !accessToken) {
      return failedStats(
        "REDX",
        typeof loginData?.message === "string"
          ? loginData.message
          : `RedX login failed: HTTP ${loginResponse.status}`
      );
    }

    const phone = withBangladeshCountryCode(input.phone);
    const statsResponse = await fetch(
      `https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=${encodeURIComponent(phone)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "OMS Courier Score/1.0",
        },
        signal: timeoutSignal(),
        cache: "no-store",
      }
    );

    const data = (await statsResponse.json().catch(() => null)) as
      | {
          code?: unknown;
          message?: unknown;
          data?: {
            totalParcels?: unknown;
            deliveredParcels?: unknown;
            returnPercentage?: unknown;
          };
        }
      | null;

    if (!statsResponse.ok || Number(data?.code ?? 0) !== 200 || !data?.data) {
      return failedStats(
        "REDX",
        typeof data?.message === "string"
          ? data.message
          : `RedX stats failed: HTTP ${statsResponse.status}`
      );
    }

    const total = Number(data.data.totalParcels ?? 0);
    const delivered = Number(data.data.deliveredParcels ?? 0);
    const returnPercentage = Number(data.data.returnPercentage ?? 0);
    const returned = Math.max(0, Math.round(total * (returnPercentage / 100)));

    return makeStats("REDX", total, delivered, returned);
  } catch (error) {
    return failedStats(
      "REDX",
      error instanceof Error ? error.message : "RedX customer history failed."
    );
  }
}
