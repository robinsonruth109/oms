const STEADFAST_ORIGIN = "https://steadfast.com.bd";
const LOGIN_URL = `${STEADFAST_ORIGIN}/login`;
const REQUEST_TIMEOUT_MS = 20_000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
} as const;

type CookieJar = Map<string, string>;

export type SteadfastSession = {
  cookieHeader: string;
  csrfToken: string;
  xsrfToken: string;
  referer: string;
};

function timeoutSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function getSetCookieValues(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  const values = headers.getSetCookie?.() ?? [];
  if (values.length > 0) return values;

  const combined = response.headers.get("set-cookie");
  if (!combined) return [];

  // Set-Cookie may contain commas inside Expires=, so only split on a comma
  // that is followed by another cookie name.
  return combined.split(/,(?=\s*[^;,\s]+=)/g);
}

function absorbResponseCookies(jar: CookieJar, response: Response) {
  for (const rawCookie of getSetCookieValues(response)) {
    const firstPart = rawCookie.split(";", 1)[0]?.trim() ?? "";
    const separator = firstPart.indexOf("=");
    if (separator <= 0) continue;

    const name = firstPart.slice(0, separator).trim();
    const value = firstPart.slice(separator + 1).trim();
    if (!name) continue;

    if (!value) jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractCsrfToken(html: string): string {
  const inputMatch = html.match(
    /<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/i
  );
  if (inputMatch?.[1]) return inputMatch[1];

  const metaMatch = html.match(
    /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i
  );
  return metaMatch?.[1] ?? "";
}

function decodeCookieValue(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveLocation(location: string | null): string {
  if (!location) return `${STEADFAST_ORIGIN}/`;

  try {
    return new URL(location, STEADFAST_ORIGIN).toString();
  } catch {
    return `${STEADFAST_ORIGIN}/`;
  }
}

function looksLikeLoginUrl(value: string) {
  try {
    return new URL(value, STEADFAST_ORIGIN).pathname.toLowerCase().includes("login");
  } catch {
    return value.toLowerCase().includes("login");
  }
}

async function readSmallText(response: Response): Promise<string> {
  try {
    const value = await response.text();
    return value.slice(0, 250_000);
  } catch {
    return "";
  }
}

/**
 * Creates a real merchant web session instead of treating the login POST alone
 * as proof of an authenticated Steadfast session. The post-login redirect is
 * visited and every Set-Cookie value is retained in a small in-memory jar.
 */
export async function createSteadfastSession(input: {
  username: string;
  password: string;
}): Promise<SteadfastSession> {
  const jar: CookieJar = new Map();

  const loginPage = await fetch(LOGIN_URL, {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "manual",
    signal: timeoutSignal(),
    cache: "no-store",
  });

  if (!loginPage.ok) {
    throw new Error(`Steadfast login page failed: HTTP ${loginPage.status}`);
  }

  absorbResponseCookies(jar, loginPage);
  const loginHtml = await readSmallText(loginPage);
  const loginCsrf = extractCsrfToken(loginHtml);

  if (!loginCsrf) {
    throw new Error("Steadfast CSRF token পাওয়া যায়নি।");
  }

  const loginResponse = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      Origin: STEADFAST_ORIGIN,
      Referer: LOGIN_URL,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    },
    body: new URLSearchParams({
      _token: loginCsrf,
      email: input.username,
      password: input.password,
    }),
    redirect: "manual",
    signal: timeoutSignal(),
    cache: "no-store",
  });

  absorbResponseCookies(jar, loginResponse);

  const location = loginResponse.headers.get("location");
  const accepted = loginResponse.status >= 200 && loginResponse.status < 400;
  const redirectedBackToLogin =
    loginResponse.status >= 300 && Boolean(location) && looksLikeLoginUrl(location!);

  if (!accepted || redirectedBackToLogin) {
    throw new Error(`Steadfast login failed: HTTP ${loginResponse.status}`);
  }

  // Follow the authenticated redirect just like a browser. This step matters
  // because Laravel may rotate the session cookie after authentication.
  const landingUrl = resolveLocation(location);
  const landingResponse = await fetch(landingUrl, {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: cookieHeader(jar),
      Referer: LOGIN_URL,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "manual",
    signal: timeoutSignal(),
    cache: "no-store",
  });

  absorbResponseCookies(jar, landingResponse);

  const landingLocation = landingResponse.headers.get("location");
  if (
    (landingResponse.status === 401 || landingResponse.status === 403) ||
    (landingResponse.status >= 300 &&
      landingResponse.status < 400 &&
      landingLocation &&
      looksLikeLoginUrl(landingLocation))
  ) {
    throw new Error("Steadfast login session যাচাই করা যায়নি।");
  }

  const landingHtml = await readSmallText(landingResponse);
  const pageCsrf = extractCsrfToken(landingHtml) || loginCsrf;
  const xsrfToken = decodeCookieValue(jar.get("XSRF-TOKEN"));
  const finalCookieHeader = cookieHeader(jar);

  if (!finalCookieHeader) {
    throw new Error("Steadfast authenticated cookies পাওয়া যায়নি।");
  }

  return {
    cookieHeader: finalCookieHeader,
    csrfToken: pageCsrf,
    xsrfToken,
    referer: landingUrl,
  };
}

export async function fetchSteadfastFraudStats(
  session: SteadfastSession,
  phone: string
): Promise<Response> {
  const url = `${STEADFAST_ORIGIN}/user/frauds/check/${encodeURIComponent(phone)}`;

  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    Accept: "application/json, text/plain, */*",
    Cookie: session.cookieHeader,
    Origin: STEADFAST_ORIGIN,
    Referer: session.referer,
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  if (session.csrfToken) headers["X-CSRF-TOKEN"] = session.csrfToken;
  if (session.xsrfToken) headers["X-XSRF-TOKEN"] = session.xsrfToken;

  return fetch(url, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: timeoutSignal(),
    cache: "no-store",
  });
}

export function describeSteadfastAccessFailure(response: Response): string {
  if (response.status === 401) {
    return "Steadfast customer-history session unauthorized (HTTP 401).";
  }

  if (response.status === 403) {
    return "Steadfast customer-history access forbidden (HTTP 403). Login works, but the fraud-check endpoint rejected this server session.";
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return location && looksLikeLoginUrl(location)
      ? "Steadfast session expired and redirected to login."
      : `Steadfast customer-history request redirected (HTTP ${response.status}).`;
  }

  return `Steadfast stats failed: HTTP ${response.status}`;
}
