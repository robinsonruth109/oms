type GraphEnvelope<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

export type MetaAdAccountPayload = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

export type MetaCampaignInsight = {
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  date_start?: string;
  date_stop?: string;
};

export function metaGraphVersion() {
  return (
    process.env.META_ADS_GRAPH_VERSION?.trim() ||
    process.env.FB_GRAPH_VERSION?.trim() ||
    "v23.0"
  );
}

export function metaRedirectUri(origin: string) {
  return (
    process.env.META_ADS_REDIRECT_URI?.trim() ||
    origin.replace(/\/$/, "") + "/api/meta-ads/callback"
  );
}

function graphBase() {
  return "https://graph.facebook.com/" + metaGraphVersion();
}

function assertConfigured() {
  const appId = process.env.META_ADS_APP_ID?.trim();
  const appSecret = process.env.META_ADS_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("META_ADS_APP_ID and META_ADS_APP_SECRET must be configured.");
  }
  return { appId, appSecret };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & GraphEnvelope<never>;
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message ||
        "Meta Graph API request failed with status " + response.status + "."
    );
  }
  return payload;
}

export async function exchangeCodeForToken(input: { code: string; redirectUri: string }) {
  const { appId, appSecret } = assertConfigured();
  const url = new URL(graphBase() + "/oauth/access_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);
  return readJson<{ access_token: string; token_type?: string; expires_in?: number }>(
    await fetch(url, { cache: "no-store" })
  );
}

export async function exchangeForLongLivedToken(shortToken: string) {
  const { appId, appSecret } = assertConfigured();
  const url = new URL(graphBase() + "/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  return readJson<{ access_token: string; token_type?: string; expires_in?: number }>(
    await fetch(url, { cache: "no-store" })
  );
}

export async function getMetaUser(accessToken: string) {
  const url = new URL(graphBase() + "/me");
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  return readJson<{ id: string; name?: string }>(await fetch(url, { cache: "no-store" }));
}

export async function listMetaAdAccounts(accessToken: string) {
  const first = new URL(graphBase() + "/me/adaccounts");
  first.searchParams.set("fields", "id,account_id,name,currency,timezone_name,account_status");
  first.searchParams.set("limit", "200");
  first.searchParams.set("access_token", accessToken);

  const accounts: MetaAdAccountPayload[] = [];
  let next: string | undefined = first.toString();
  while (next) {
    const payload = await readJson<GraphEnvelope<MetaAdAccountPayload>>(
      await fetch(next, { cache: "no-store" })
    );
    accounts.push(...(payload.data || []));
    next = payload.paging?.next;
  }
  return accounts;
}

export async function getCampaignInsights(input: {
  accessToken: string;
  metaAccountId: string;
  fromDate: string;
  toDate: string;
}) {
  const first = new URL(
    graphBase() + "/act_" + encodeURIComponent(input.metaAccountId) + "/insights"
  );
  first.searchParams.set("level", "campaign");
  first.searchParams.set(
    "fields",
    "account_id,account_name,campaign_id,campaign_name,spend,date_start,date_stop"
  );
  first.searchParams.set("time_increment", "1");
  first.searchParams.set("limit", "500");
  first.searchParams.set("time_range", JSON.stringify({ since: input.fromDate, until: input.toDate }));
  first.searchParams.set("access_token", input.accessToken);

  const rows: MetaCampaignInsight[] = [];
  let next: string | undefined = first.toString();
  while (next) {
    const payload = await readJson<GraphEnvelope<MetaCampaignInsight>>(
      await fetch(next, { cache: "no-store" })
    );
    rows.push(...(payload.data || []));
    next = payload.paging?.next;
  }
  return rows;
}
