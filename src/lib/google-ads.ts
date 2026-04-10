import { prisma } from "./db";
import { createLogger } from "./logger";

const log = createLogger("google-ads");

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI!;
const API_BASE = "https://googleads.googleapis.com/v19";
const OAUTH_BASE = "https://oauth2.googleapis.com";

function parseErrorResponse(status: number, text: string): string {
  // Try JSON first
  try {
    const json = JSON.parse(text);
    const msg = json.error?.message || json.error_description || json.error || text;
    return `${status} - ${msg}`;
  } catch {
    // Strip HTML tags if response is HTML
    if (text.includes("<html") || text.includes("<!DOCTYPE")) {
      return `${status} - Endpoint retornou HTML (URL possivelmente incorreta)`;
    }
    return `${status} - ${text.slice(0, 300)}`;
  }
}

// --- OAuth ---

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
  log.info("Trocando code por tokens");
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    log.error("Falha ao trocar code por tokens", { error });
    throw new Error(`Falha no token exchange: ${error}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  log.info("Renovando access token");
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    log.error("Falha ao renovar token", { error });
    throw new Error(`Falha ao renovar token: ${error}`);
  }
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

// --- Google Ads API fetch ---

async function gadsFetch(
  customerId: string,
  accessToken: string,
  path: string,
  options?: RequestInit
) {
  const cleanId = customerId.replace(/-/g, "");
  const url = `${API_BASE}/customers/${cleanId}${path}`;
  log.debug("gadsFetch", { path, customerId: cleanId });
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    log.error("Google Ads API erro", { path, error });
    throw new Error(`Google Ads API: ${error}`);
  }
  return res.json();
}

// --- Token management ---

export async function getValidToken(userId: string) {
  const connection = await prisma.googleAdsConnection.findUnique({
    where: { userId },
  });
  if (!connection) return null;

  const fiveMinutes = 5 * 60 * 1000;
  if (connection.tokenExpiry.getTime() - Date.now() < fiveMinutes) {
    try {
      const refreshed = await refreshAccessToken(connection.refreshToken);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
      await prisma.googleAdsConnection.update({
        where: { userId },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiry: newExpiry,
        },
      });
      return {
        accessToken: refreshed.access_token,
        customerId: connection.customerId,
      };
    } catch {
      await prisma.googleAdsConnection.delete({ where: { userId } });
      return null;
    }
  }

  return {
    accessToken: connection.accessToken,
    customerId: connection.customerId,
  };
}

// --- Data functions ---

export async function listAccessibleAccounts(accessToken: string) {
  log.info("Listando contas acessíveis");
  const res = await fetch(
    `${API_BASE}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEVELOPER_TOKEN,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    log.error("Falha ao listar contas", { error });
    throw new Error(`Falha ao listar contas Google Ads: ${error}`);
  }
  const data = await res.json();
  const ids: string[] = (data.resourceNames || []).map((r: string) =>
    r.replace("customers/", "")
  );
  return ids;
}

export async function getCampaignMetrics(
  customerId: string,
  accessToken: string,
  dateRange = "LAST_30_DAYS"
) {
  const query = `
    SELECT
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING ${dateRange}
    ORDER BY metrics.impressions DESC
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

  const results = data.results || [];
  return results.map(
    (r: {
      campaign: { name: string; status: string };
      metrics: {
        impressions: string;
        clicks: string;
        ctr: number;
        averageCpc: number;
        costMicros: string;
      };
    }) => ({
      name: r.campaign.name,
      status: r.campaign.status,
      impressions: parseInt(r.metrics.impressions || "0"),
      clicks: parseInt(r.metrics.clicks || "0"),
      ctr: r.metrics.ctr || 0,
      cpc: (r.metrics.averageCpc || 0) / 1_000_000,
      spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    })
  );
}

export async function getAccountSummary(
  customerId: string,
  accessToken: string,
  dateRange = "LAST_30_DAYS"
) {
  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros
    FROM customer
    WHERE segments.date DURING ${dateRange}
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

  const results = data.results || [];
  if (results.length === 0) {
    return { impressions: 0, clicks: 0, ctr: 0, cpc: 0, spend: 0 };
  }

  let impressions = 0,
    clicks = 0,
    costMicros = 0;

  for (const r of results) {
    impressions += parseInt(r.metrics.impressions || "0");
    clicks += parseInt(r.metrics.clicks || "0");
    costMicros += parseInt(r.metrics.costMicros || "0");
  }

  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? costMicros / 1_000_000 / clicks : 0,
    spend: costMicros / 1_000_000,
  };
}
