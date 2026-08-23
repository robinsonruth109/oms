import {
  decryptPathaoCredentials,
  decryptPathaoToken,
  encryptPathaoToken,
} from "./crypto";
import type {
  PathaoBulkResponse,
  PathaoOrderInfo,
  PathaoOrderPayload,
  PathaoStore,
} from "./types";

const SANDBOX_URL = "https://courier-api-sandbox.pathao.com";
const LIVE_URL = "https://api-hermes.pathao.com";

type CourierRow = {
  id: string;
  pathaoEnabled: boolean;
  pathaoEnvironment: "SANDBOX" | "LIVE";
  pathaoCredentialsEncrypted: string | null;
  pathaoCredentialsIv: string | null;
  pathaoCredentialsTag: string | null;
  pathaoTokenEncrypted: string | null;
  pathaoTokenIv: string | null;
  pathaoTokenTag: string | null;
  pathaoTokenExpiresAt: Date | null;
};

function baseUrl(environment: "SANDBOX" | "LIVE") {
  return environment === "SANDBOX" ? SANDBOX_URL : LIVE_URL;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message || "")
        : text;

    throw new Error(
      `Pathao API failed (${response.status})${message ? `: ${message}` : ""}`
    );
  }

  return body;
}

async function issuePasswordToken(courier: CourierRow) {
  const credentials = decryptPathaoCredentials(courier);

  if (!credentials) {
    throw new Error("Pathao API credentials are not configured.");
  }

  const response = await fetch(
    `${baseUrl(courier.pathaoEnvironment)}/aladdin/api/v1/issue-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "password",
        username: credentials.username,
        password: credentials.password,
      }),
      cache: "no-store",
    }
  );

  const body = (await parseResponse(response)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error("Pathao token response did not include access/refresh token.");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: Math.max(60, Number(body.expires_in || 432000)),
  };
}

async function refreshToken(courier: CourierRow, refreshTokenValue: string) {
  const credentials = decryptPathaoCredentials(courier);

  if (!credentials) {
    throw new Error("Pathao API credentials are not configured.");
  }

  const response = await fetch(
    `${baseUrl(courier.pathaoEnvironment)}/aladdin/api/v1/issue-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshTokenValue,
      }),
      cache: "no-store",
    }
  );

  const body = (await parseResponse(response)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token || !body.refresh_token) {
    throw new Error("Pathao refresh response did not include access/refresh token.");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: Math.max(60, Number(body.expires_in || 432000)),
  };
}

async function saveToken(courierId: string, token: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const encrypted = encryptPathaoToken({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
  });

  const { prisma } = await import("@/lib/prisma");

  await prisma.courier.update({
    where: { id: courierId },
    data: {
      pathaoTokenEncrypted: encrypted.encrypted,
      pathaoTokenIv: encrypted.iv,
      pathaoTokenTag: encrypted.tag,
      pathaoTokenExpiresAt: new Date(
        Date.now() + Math.max(60, token.expiresIn - 300) * 1000
      ),
    },
  });

  return token.accessToken;
}

async function getAccessToken(courier: CourierRow, forceFresh = false) {
  if (!courier.pathaoEnabled) {
    throw new Error("Pathao integration is disabled for this courier.");
  }

  const existing = decryptPathaoToken(courier);
  const expiry = courier.pathaoTokenExpiresAt?.getTime() || 0;

  if (
    !forceFresh &&
    existing?.accessToken &&
    expiry > Date.now() + 60_000
  ) {
    return existing.accessToken;
  }

  if (existing?.refreshToken && !forceFresh) {
    try {
      return await saveToken(
        courier.id,
        await refreshToken(courier, existing.refreshToken)
      );
    } catch {
      // Fall through to full password grant.
    }
  }

  return saveToken(courier.id, await issuePasswordToken(courier));
}

async function authorizedRequest<T>(
  courier: CourierRow,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let token = await getAccessToken(courier);

  const doRequest = (accessToken: string) =>
    fetch(`${baseUrl(courier.pathaoEnvironment)}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

  let response = await doRequest(token);

  if (response.status === 401) {
    token = await getAccessToken(courier, true);
    response = await doRequest(token);
  }

  return (await parseResponse(response)) as T;
}

export async function getPathaoCourier(courierId: string) {
  const { prisma } = await import("@/lib/prisma");

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
  });

  if (!courier) {
    throw new Error("Courier not found.");
  }

  return courier;
}

export async function getPathaoStores(courierId: string) {
  const courier = await getPathaoCourier(courierId);

  const response = await authorizedRequest<{
    data?: {
      data?: PathaoStore[];
    };
  }>(courier, "/aladdin/api/v1/stores");

  return response?.data?.data || [];
}

export async function testPathaoConnection(courierId: string) {
  const courier = await getPathaoCourier(courierId);
  await getAccessToken(courier, true);
  const stores = await getPathaoStores(courierId);

  return stores;
}

export async function createPathaoBulkOrders(
  courierId: string,
  orders: PathaoOrderPayload[]
) {
  const courier = await getPathaoCourier(courierId);

  return authorizedRequest<PathaoBulkResponse>(
    courier,
    "/aladdin/api/v1/orders/bulk",
    {
      method: "POST",
      body: JSON.stringify({ orders }),
    }
  );
}

export async function getPathaoOrderInfo(
  courierId: string,
  consignmentId: string
) {
  const courier = await getPathaoCourier(courierId);

  const response = await authorizedRequest<{
    data?: PathaoOrderInfo;
  }>(
    courier,
    `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`
  );

  return response.data || {};
}
