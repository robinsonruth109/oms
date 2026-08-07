import type { CourierProvider } from "../types";

type ConnectionInput = {
  provider: CourierProvider;
  username: string;
  password: string;
};

type ConnectionResult = {
  success: boolean;
  message: string;
};

const REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function testPathao(username: string, password: string): Promise<ConnectionResult> {
  const response = await fetch("https://merchant.pathao.com/api/v1/login", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "OMS Courier Integration/1.0",
    },
    body: JSON.stringify({ username, password }),
    signal: timeoutSignal(),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { access_token?: unknown; message?: unknown }
    | null;

  if (!response.ok || typeof data?.access_token !== "string" || !data.access_token.trim()) {
    const detail = typeof data?.message === "string" ? data.message : `HTTP ${response.status}`;
    return { success: false, message: `Pathao login failed: ${detail}` };
  }

  return { success: true, message: "Pathao connection successful." };
}

async function testSteadfast(username: string, password: string): Promise<ConnectionResult> {
  try {
    const { createSteadfastSession } = await import("./steadfast-session");
    await createSteadfastSession({ username, password });
    return { success: true, message: "Steadfast authenticated session successful." };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Steadfast authenticated session failed.",
    };
  }
}

function formatRedXPhone(value: string): string {
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("880")) phone = phone.slice(3);
  if (phone.startsWith("88")) phone = phone.slice(2);
  return `88${phone}`;
}

async function testRedX(username: string, password: string): Promise<ConnectionResult> {
  const response = await fetch("https://api.redx.com.bd/v4/auth/login", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "OMS Courier Integration/1.0",
    },
    body: JSON.stringify({ phone: formatRedXPhone(username), password }),
    signal: timeoutSignal(),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { data?: { accessToken?: unknown }; message?: unknown }
    | null;

  if (!response.ok || typeof data?.data?.accessToken !== "string") {
    const detail = typeof data?.message === "string" ? data.message : `HTTP ${response.status}`;
    return { success: false, message: `RedX login failed: ${detail}` };
  }

  return { success: true, message: "RedX connection successful." };
}

export async function testCourierConnection(input: ConnectionInput): Promise<ConnectionResult> {
  try {
    if (input.provider === "PATHAO") return await testPathao(input.username, input.password);
    if (input.provider === "STEADFAST") return await testSteadfast(input.username, input.password);
    return await testRedX(input.username, input.password);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { success: false, message: `${input.provider} connection timed out.` };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : `${input.provider} connection failed.`,
    };
  }
}
