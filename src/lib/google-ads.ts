import { prisma } from "./db";
import { createLogger } from "./logger";
import * as demo from "./google-ads-demo";

const log = createLogger("google-ads");

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI || "";
const API_BASE = "https://googleads.googleapis.com/v23";
const OAUTH_BASE = "https://oauth2.googleapis.com";

function validateEnvVars() {
  const missing: string[] = [];
  if (!DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!CLIENT_ID) missing.push("GOOGLE_ADS_CLIENT_ID");
  if (!CLIENT_SECRET) missing.push("GOOGLE_ADS_CLIENT_SECRET");
  if (!REDIRECT_URI) missing.push("GOOGLE_ADS_REDIRECT_URI");
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente faltando: ${missing.join(", ")}`);
  }
}

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

/**
 * Extracts structured error details from a Google Ads API JSON error response.
 * Returns null if the text is not a valid Google Ads error JSON.
 */
function extractGoogleAdsErrorDetails(text: string): {
  status: string;
  code: number;
  message: string;
  errorCode?: string;
} | null {
  try {
    const json = JSON.parse(text);
    const err = json.error;
    if (!err) return null;
    // Google Ads API errors have error.details[].errors[].errorCode
    const firstDetail = err.details?.[0]?.errors?.[0];
    const errorCode = firstDetail?.errorCode
      ? Object.entries(firstDetail.errorCode).map(([k, v]) => `${k}:${v}`).join(",")
      : undefined;
    return {
      status: err.status || "",
      code: err.code || 0,
      message: err.message || "",
      errorCode,
    };
  } catch {
    return null;
  }
}

// --- Error parsing ---

/**
 * Error code constants for programmatic handling on the frontend.
 * These are returned alongside user messages so the UI can react accordingly.
 */
export const GADS_ERROR_CODES = {
  MCC_MISMATCH: "google-ads-mcc-mismatch",
  MANAGER_ACCOUNT_NEEDS_LOGIN_ID: "google-ads-manager-needs-login-id",
  TOKEN_EXPIRED: "google-ads-token-expired",
  TOKEN_REVOKED: "google-ads-token-revoked",
  ACCOUNT_NOT_ENABLED: "google-ads-account-not-enabled",
  ACCOUNT_SUSPENDED: "google-ads-account-suspended",
  NOT_ADS_USER: "google-ads-not-ads-user",
  DEVELOPER_TOKEN_ERROR: "google-ads-developer-token",
  RATE_LIMIT: "google-ads-rate-limit",
  INVALID_CUSTOMER_ID: "google-ads-invalid-customer-id",
  PERMISSION_DENIED: "google-ads-permission-denied",
  UNKNOWN: "google-ads-unknown",
} as const;

export type GadsErrorCode = (typeof GADS_ERROR_CODES)[keyof typeof GADS_ERROR_CODES];

export interface GadsError {
  code: GadsErrorCode;
  message: string;
}

export function parseGoogleAdsError(errorString: string): GadsError {
  const lower = errorString.toLowerCase();

  // --- Account status errors (check FIRST — these are the most specific) ---
  // CUSTOMER_NOT_ENABLED also returns 403, so must be checked before generic 403 handlers

  if (
    lower.includes("customer_not_enabled") ||
    lower.includes("not yet enabled") ||
    lower.includes("has been deactivated") ||
    (lower.includes("account") && lower.includes("not") && lower.includes("enabled"))
  ) {
    return {
      code: GADS_ERROR_CODES.ACCOUNT_NOT_ENABLED,
      message:
        "A conta Google Ads existe mas não está ativada ou não completou a configuração. " +
        "Acesse ads.google.com com a conta conectada, aceite os Termos de Serviço e configure o faturamento. " +
        "Após ativar a conta, volte aqui e reconecte.",
    };
  }

  if (lower.includes("not_ads_user") || lower.includes("not an ads user")) {
    return {
      code: GADS_ERROR_CODES.NOT_ADS_USER,
      message: "Esta conta Google não possui uma conta Google Ads associada. Crie uma conta em ads.google.com primeiro.",
    };
  }

  if (lower.includes("not_active") || lower.includes("suspended") || lower.includes("canceled")) {
    return {
      code: GADS_ERROR_CODES.ACCOUNT_SUSPENDED,
      message: "A conta Google Ads está suspensa ou cancelada. Verifique o status em ads.google.com.",
    };
  }

  if (lower.includes("billing") || lower.includes("payment")) {
    return {
      code: GADS_ERROR_CODES.ACCOUNT_NOT_ENABLED,
      message: "Configuração de faturamento pendente na conta Google Ads. Configure o método de pagamento em ads.google.com.",
    };
  }

  // --- 403 / Permission errors (after account status checks) ---

  // Developer token not authorized for this customer account (MCC mismatch)
  if (
    (lower.includes("403") || lower.includes("permission_denied")) &&
    (lower.includes("developer token") ||
     lower.includes("developer_token") ||
     lower.includes("not authorized to access"))
  ) {
    return {
      code: GADS_ERROR_CODES.MCC_MISMATCH,
      message:
        "A conta Google Ads conectada não pertence ao MCC (conta gerenciadora) configurado neste app. " +
        "O developer token só permite acessar contas vinculadas ao seu MCC. " +
        "Solução: conecte com a conta Google que administra o MCC do developer token, " +
        "ou vincule esta conta Google Ads ao MCC no Google Ads.",
    };
  }

  // Manager account used without login-customer-id header
  if (
    lower.includes("manager") &&
    (lower.includes("login-customer-id") || lower.includes("login_customer_id"))
  ) {
    return {
      code: GADS_ERROR_CODES.MANAGER_ACCOUNT_NEEDS_LOGIN_ID,
      message:
        "A conta selecionada é uma conta gerenciadora (MCC). " +
        "É necessário especificar o login-customer-id. Reconecte nas configurações.",
    };
  }

  // Account is a manager and can't be queried directly for metrics
  if (
    lower.includes("cannot_query") && lower.includes("manager")
  ) {
    return {
      code: GADS_ERROR_CODES.MANAGER_ACCOUNT_NEEDS_LOGIN_ID,
      message:
        "Não é possível buscar métricas de uma conta gerenciadora (MCC) diretamente. " +
        "Desconecte e reconecte selecionando uma conta cliente.",
    };
  }

  // Generic 403 — after all specific checks
  if (lower.includes("the caller does not have permission")) {
    return {
      code: GADS_ERROR_CODES.PERMISSION_DENIED,
      message:
        "Sem permissão para acessar esta conta Google Ads. " +
        "Possíveis causas: (1) a conta não completou a configuração em ads.google.com, " +
        "(2) a conta não está vinculada ao MCC do developer token, ou " +
        "(3) o usuário OAuth não tem acesso à conta. " +
        "Desconecte e reconecte nas configurações.",
    };
  }

  // --- 401 / Token errors ---

  if (lower.includes("token has been expired") || lower.includes("token has been revoked") || lower.includes("invalid_grant")) {
    return {
      code: GADS_ERROR_CODES.TOKEN_REVOKED,
      message:
        "O token de acesso foi revogado ou expirou permanentemente. " +
        "Desconecte e reconecte sua conta Google Ads nas configurações.",
    };
  }

  if (lower.includes("401") || lower.includes("unauthenticated")) {
    return {
      code: GADS_ERROR_CODES.TOKEN_EXPIRED,
      message:
        "Token de autenticação expirado. Tente recarregar a página. " +
        "Se o erro persistir, reconecte sua conta Google Ads nas configurações.",
    };
  }

  // --- Generic permission / 403 (catchall) ---

  if (lower.includes("403") || lower.includes("permission") || lower.includes("access_denied") || lower.includes("authorization_error")) {
    return {
      code: GADS_ERROR_CODES.PERMISSION_DENIED,
      message:
        "Sem permissão para acessar esta conta Google Ads. " +
        "Verifique se a conta completou a configuração em ads.google.com " +
        "e se está vinculada ao MCC do developer token. " +
        "Desconecte e reconecte nas configurações.",
    };
  }

  if (lower.includes("developer_token") || lower.includes("developer token")) {
    return {
      code: GADS_ERROR_CODES.DEVELOPER_TOKEN_ERROR,
      message: "Erro de configuração do developer token. Contate o suporte técnico.",
    };
  }

  if (lower.includes("rate_limit") || lower.includes("quota")) {
    return {
      code: GADS_ERROR_CODES.RATE_LIMIT,
      message: "Limite de requisições da API Google Ads atingido. Tente novamente em alguns minutos.",
    };
  }

  if (lower.includes("invalid_customer_id") || lower.includes("customer_id")) {
    return {
      code: GADS_ERROR_CODES.INVALID_CUSTOMER_ID,
      message: "ID da conta Google Ads é inválido. Reconecte nas configurações.",
    };
  }

  // Fallback: return a cleaned version of the error
  const cleanError = errorString
    .replace(/^Error:\s*/i, "")
    .replace(/^Google Ads API:\s*/i, "");
  return {
    code: GADS_ERROR_CODES.UNKNOWN,
    message: cleanError.length > 200 ? cleanError.slice(0, 200) + "..." : cleanError,
  };
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
  options?: RequestInit,
  loginCustomerId?: string
) {
  validateEnvVars();
  const cleanId = customerId.replace(/-/g, "");
  const url = `${API_BASE}/customers/${cleanId}${path}`;
  log.debug("gadsFetch", { path, customerId: cleanId, loginCustomerId });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  }
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    const structuredError = extractGoogleAdsErrorDetails(text);

    // Log with full context so developers can diagnose from server logs
    log.error("Google Ads API erro", {
      path,
      customerId: cleanId,
      loginCustomerId,
      httpStatus: res.status,
      error,
      errorCode: structuredError?.errorCode,
      googleStatus: structuredError?.status,
      hint: res.status === 403
        ? structuredError?.errorCode?.includes("CUSTOMER_NOT_ENABLED")
          ? "CAUSA: conta Google Ads não ativada. Usuário precisa finalizar setup em ads.google.com (ToS + billing)."
          : "PROVÁVEL CAUSA: developer token não tem permissão para esta conta, ou conta não está ativada. " +
            "Verifique se a conta completou o setup em ads.google.com e se esta vinculada ao MCC do developer token."
        : res.status === 401
        ? "Token OAuth expirado ou revogado. Tentar refresh."
        : undefined,
    });
    // Include the structured errorCode in the thrown message so parseGoogleAdsError can detect it
    const errorCodeSuffix = structuredError?.errorCode ? ` [${structuredError.errorCode}]` : "";
    throw new Error(`Google Ads API: ${error}${errorCodeSuffix}`);
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
  const tokenAge = connection.tokenExpiry.getTime() - Date.now();

  // Always refresh if token is expired or expiring soon
  if (tokenAge < fiveMinutes) {
    log.info("Token expirado ou expirando, renovando", {
      userId,
      expiresIn: Math.round(tokenAge / 1000),
    });
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
        loginCustomerId: connection.loginCustomerId,
      };
    } catch (err) {
      log.error("Falha ao renovar token, desconectando", {
        userId,
        error: String(err),
      });
      await prisma.googleAdsConnection.delete({ where: { userId } });
      return null;
    }
  }

  return {
    accessToken: connection.accessToken,
    customerId: connection.customerId,
    loginCustomerId: connection.loginCustomerId,
  };
}

// --- Token retry on auth failure ---

export async function refreshAndRetry<T>(
  userId: string,
  apiCall: (newAccessToken: string) => Promise<T>
): Promise<T | null> {
  const connection = await prisma.googleAdsConnection.findUnique({
    where: { userId },
  });
  if (!connection) return null;

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
    return await apiCall(refreshed.access_token);
  } catch (err) {
    log.error("refreshAndRetry falhou, desconectando", {
      userId,
      error: String(err),
    });
    await prisma.googleAdsConnection.delete({ where: { userId } });
    return null;
  }
}

// --- Account detection ---

export async function isManagerAccount(
  customerId: string,
  accessToken: string
): Promise<boolean> {
  validateEnvVars();
  const cleanId = customerId.replace(/-/g, "");
  log.info("Verificando se conta é MCC (manager)", { customerId: cleanId });
  try {
    const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": cleanId,
      },
      body: JSON.stringify({
        query: "SELECT customer.manager FROM customer LIMIT 1",
      }),
    });
    if (!res.ok) {
      log.warn("Falha ao verificar tipo da conta", { customerId: cleanId, status: res.status });
      return false;
    }
    const data = await res.json();
    const isManager = data.results?.[0]?.customer?.manager === true;
    log.info("Tipo da conta detectado", { customerId: cleanId, isManager });
    return isManager;
  } catch (err) {
    log.error("Erro ao verificar tipo da conta", { error: String(err) });
    return false;
  }
}

export async function listManagedAccounts(
  mccId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; isManager: boolean }>> {
  validateEnvVars();
  const cleanId = mccId.replace(/-/g, "");
  log.info("Listando contas gerenciadas pelo MCC", { mccId: cleanId });
  const query = `
    SELECT
      customer_client.client_customer,
      customer_client.descriptive_name,
      customer_client.manager,
      customer_client.level
    FROM customer_client
    WHERE customer_client.level = 1
  `;

  const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      "login-customer-id": cleanId,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    const error = parseErrorResponse(res.status, text);
    log.error("Falha ao listar contas gerenciadas", { error });
    throw new Error(`Falha ao listar contas do MCC: ${error}`);
  }

  const data = await res.json();
  const results = data.results || [];
  return results.map(
    (r: {
      customerClient: {
        clientCustomer: string;
        descriptiveName: string;
        manager: boolean;
      };
    }) => ({
      id: r.customerClient.clientCustomer.replace("customers/", ""),
      name: r.customerClient.descriptiveName || "Sem nome",
      isManager: r.customerClient.manager || false,
    })
  );
}

// --- Data functions ---

export async function listAccessibleAccounts(accessToken: string) {
  validateEnvVars();
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

// --- Date range utility ---

const VALID_DATE_RANGES = [
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
  "LAST_90_DAYS",
  "ALL_TIME",
] as const;

export type DateRange = (typeof VALID_DATE_RANGES)[number];

export function parseDateRange(range?: string | null): DateRange {
  if (!range) return "ALL_TIME";
  const upper = range.toUpperCase();
  if (VALID_DATE_RANGES.includes(upper as DateRange)) return upper as DateRange;
  return "ALL_TIME";
}

function dateWhereClause(dateRange: DateRange, prefix = "WHERE"): string {
  return dateRange !== "ALL_TIME" ? `${prefix} segments.date DURING ${dateRange}` : "";
}

// --- Data functions ---

export async function getCampaignMetrics(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    log.info("Modo demo ativo — retornando campanhas fictícias");
    return demo.getDemoCampaigns();
  }

  const query = `
    SELECT
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_per_conversion,
      metrics.search_impression_share
    FROM campaign
    ${dateWhereClause(dateRange)}
    ORDER BY metrics.impressions DESC
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    name: r.campaign.name,
    status: r.campaign.status,
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    cpc: parseInt(r.metrics.averageCpc || "0") / 1_000_000,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
    conversionsValue: parseFloat(r.metrics.conversionsValue || "0"),
    costPerConversion: parseFloat(r.metrics.costPerConversion || "0") / 1_000_000,
    searchImpressionShare: parseFloat(r.metrics.searchImpressionShare || "0"),
  }));
}

export async function getAccountSummary(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    log.info("Modo demo ativo — retornando summary fictício");
    return demo.getDemoSummary();
  }

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_per_conversion
    FROM customer
    ${dateWhereClause(dateRange)}
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  const results = data.results || [];
  if (results.length === 0) {
    return { impressions: 0, clicks: 0, ctr: 0, cpc: 0, spend: 0, conversions: 0, conversionsValue: 0, costPerConversion: 0 };
  }

  let impressions = 0, clicks = 0, costMicros = 0, conversions = 0, conversionsValue = 0;

  for (const r of results) {
    impressions += parseInt(r.metrics.impressions || "0");
    clicks += parseInt(r.metrics.clicks || "0");
    costMicros += parseInt(r.metrics.costMicros || "0");
    conversions += parseFloat(r.metrics.conversions || "0");
    conversionsValue += parseFloat(r.metrics.conversionsValue || "0");
  }

  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? costMicros / 1_000_000 / clicks : 0,
    spend: costMicros / 1_000_000,
    conversions,
    conversionsValue,
    costPerConversion: conversions > 0 ? costMicros / 1_000_000 / conversions : 0,
  };
}

// --- Ad Groups ---

export async function getAdGroupMetrics(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoAdGroups();
  }

  const dateClause = dateRange !== "ALL_TIME" ? `AND segments.date DURING ${dateRange}` : "";
  const query = `
    SELECT
      campaign.name, campaign.id,
      ad_group.name, ad_group.status, ad_group.id,
      ad_group.cpc_bid_micros,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.average_cpc, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value
    FROM ad_group
    WHERE campaign.status != 'REMOVED' ${dateClause}
    ORDER BY metrics.impressions DESC
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    campaignName: r.campaign.name,
    campaignId: r.campaign.id,
    name: r.adGroup.name,
    id: r.adGroup.id,
    status: r.adGroup.status,
    cpcBid: parseInt(r.adGroup.cpcBidMicros || "0") / 1_000_000,
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    cpc: parseInt(r.metrics.averageCpc || "0") / 1_000_000,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
    conversionsValue: parseFloat(r.metrics.conversionsValue || "0"),
  }));
}

// --- Keywords ---

export async function getKeywordMetrics(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoKeywords();
  }

  const dateClause = dateRange !== "ALL_TIME" ? `AND segments.date DURING ${dateRange}` : "";
  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.effective_cpc_bid_micros,
      ad_group_criterion.status,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.average_cpc, metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE ad_group_criterion.status != 'REMOVED' ${dateClause}
    ORDER BY metrics.impressions DESC
    LIMIT 200
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    campaignName: r.campaign.name,
    adGroupName: r.adGroup.name,
    text: r.adGroupCriterion?.keyword?.text || "",
    matchType: r.adGroupCriterion?.keyword?.matchType || "",
    qualityScore: r.adGroupCriterion?.qualityInfo?.qualityScore || 0,
    bid: parseInt(r.adGroupCriterion?.effectiveCpcBidMicros || "0") / 1_000_000,
    status: r.adGroupCriterion?.status || "",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    cpc: parseInt(r.metrics.averageCpc || "0") / 1_000_000,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
  }));
}

// --- Search Terms ---

export async function getSearchTerms(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoSearchTerms();
  }

  const query = `
    SELECT
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      search_term_view.status,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.cost_micros, metrics.conversions
    FROM search_term_view
    ${dateWhereClause(dateRange)}
    ORDER BY metrics.impressions DESC
    LIMIT 100
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    searchTerm: r.searchTermView?.searchTerm || "",
    campaignName: r.campaign.name,
    adGroupName: r.adGroup.name,
    status: r.searchTermView?.status || "",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
  }));
}

// --- Device Breakdown ---

export async function getDeviceBreakdown(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoDevices();
  }

  const query = `
    SELECT
      segments.device,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.average_cpc, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value
    FROM customer
    ${dateWhereClause(dateRange)}
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    device: r.segments?.device || "UNKNOWN",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    cpc: parseInt(r.metrics.averageCpc || "0") / 1_000_000,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
    conversionsValue: parseFloat(r.metrics.conversionsValue || "0"),
  }));
}

// --- Demographics ---

export async function getDemographics(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoDemographics();
  }

  const ageQuery = `
    SELECT
      ad_group_criterion.age_range.type,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM age_range_view
    ${dateWhereClause(dateRange)}
  `;

  const genderQuery = `
    SELECT
      ad_group_criterion.gender.type,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM gender_view
    ${dateWhereClause(dateRange)}
  `;

  const [ageData, genderData] = await Promise.all([
    gadsFetch(customerId, accessToken, "/googleAds:search", {
      method: "POST",
      body: JSON.stringify({ query: ageQuery }),
    }, loginCustomerId || undefined),
    gadsFetch(customerId, accessToken, "/googleAds:search", {
      method: "POST",
      body: JSON.stringify({ query: genderQuery }),
    }, loginCustomerId || undefined),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const age = (ageData.results || []).map((r: any) => ({
    ageRange: r.adGroupCriterion?.ageRange?.type || "UNKNOWN",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gender = (genderData.results || []).map((r: any) => ({
    gender: r.adGroupCriterion?.gender?.type || "UNKNOWN",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
  }));

  return { age, gender };
}

// --- Location Performance ---

export async function getLocationPerformance(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoLocations();
  }

  const query = `
    SELECT
      campaign_criterion.location.geo_target_constant,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.cost_micros, metrics.conversions
    FROM user_location_view
    ${dateWhereClause(dateRange)}
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    location: r.campaignCriterion?.location?.geoTargetConstant || "Desconhecido",
    locationType: "LOCATION",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    ctr: r.metrics.ctr || 0,
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
  }));
}

// --- Daily Performance ---

export async function getDailyPerformance(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "LAST_30_DAYS",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoDaily();
  }

  const effectiveRange = dateRange === "ALL_TIME" ? "LAST_30_DAYS" : dateRange;
  const query = `
    SELECT
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value
    FROM customer
    WHERE segments.date DURING ${effectiveRange}
    ORDER BY segments.date ASC
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    date: r.segments?.date || "",
    impressions: parseInt(r.metrics.impressions || "0"),
    clicks: parseInt(r.metrics.clicks || "0"),
    spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    conversions: parseFloat(r.metrics.conversions || "0"),
    conversionsValue: parseFloat(r.metrics.conversionsValue || "0"),
  }));
}

// --- Budget Utilization ---

export async function getBudgetUtilization(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoBudgets();
  }

  const dateClause = dateRange !== "ALL_TIME" ? `AND segments.date DURING ${dateRange}` : "";
  const query = `
    SELECT
      campaign.name, campaign.status,
      campaign_budget.amount_micros,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status != 'REMOVED' ${dateClause}
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => {
    const dailyBudget = parseInt(r.campaignBudget?.amountMicros || "0") / 1_000_000;
    const spend = parseInt(r.metrics.costMicros || "0") / 1_000_000;
    return {
      campaignName: r.campaign.name,
      status: r.campaign.status,
      dailyBudget,
      spend,
      utilization: dailyBudget > 0 ? spend / dailyBudget : 0,
    };
  });
}

// --- Change History ---

export async function getChangeHistory(
  customerId: string,
  accessToken: string,
  _dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoChangeHistory();
  }

  const query = `
    SELECT
      change_event.change_date_time,
      change_event.change_resource_type,
      change_event.resource_change_operation,
      change_event.user_email
    FROM change_event
    WHERE change_event.change_date_time DURING LAST_14_DAYS
    ORDER BY change_event.change_date_time DESC
    LIMIT 50
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    date: r.changeEvent?.changeDateTime || "",
    resourceType: r.changeEvent?.changeResourceType || "",
    operation: r.changeEvent?.resourceChangeOperation || "",
    userEmail: r.changeEvent?.userEmail || "",
  }));
}

// --- Recommendations ---

export async function getRecommendations(
  customerId: string,
  accessToken: string,
  _dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoRecommendations();
  }

  const query = `
    SELECT
      recommendation.type,
      recommendation.campaign,
      recommendation.impact.base_metrics.impressions,
      recommendation.impact.base_metrics.clicks,
      recommendation.impact.base_metrics.cost_micros,
      recommendation.impact.potential_metrics.impressions,
      recommendation.impact.potential_metrics.clicks,
      recommendation.impact.potential_metrics.cost_micros
    FROM recommendation
    LIMIT 30
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => ({
    type: r.recommendation?.type || "",
    campaign: r.recommendation?.campaign || "",
    impactImpressions: parseInt(r.recommendation?.impact?.baseMetrics?.impressions || "0"),
    impactClicks: parseInt(r.recommendation?.impact?.baseMetrics?.clicks || "0"),
    impactCost: parseInt(r.recommendation?.impact?.baseMetrics?.costMicros || "0") / 1_000_000,
    potentialImpressions: parseInt(r.recommendation?.impact?.potentialMetrics?.impressions || "0"),
    potentialClicks: parseInt(r.recommendation?.impact?.potentialMetrics?.clicks || "0"),
    potentialCost: parseInt(r.recommendation?.impact?.potentialMetrics?.costMicros || "0") / 1_000_000,
  }));
}

// --- Ad Metrics ---

export async function getAdMetrics(
  customerId: string,
  accessToken: string,
  dateRange: DateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    return demo.getDemoAds();
  }

  const dateClause = dateRange !== "ALL_TIME" ? `AND segments.date DURING ${dateRange}` : "";
  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.cost_micros, metrics.conversions
    FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED' ${dateClause}
    ORDER BY metrics.impressions DESC
    LIMIT 100
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results || []).map((r: any) => {
    const rsa = r.adGroupAd?.ad?.responsiveSearchAd;
    return {
      campaignName: r.campaign.name,
      adGroupName: r.adGroup.name,
      headlines: (rsa?.headlines || []).map((h: { text: string }) => h.text),
      descriptions: (rsa?.descriptions || []).map((d: { text: string }) => d.text),
      finalUrls: r.adGroupAd?.ad?.finalUrls || [],
      status: r.adGroupAd?.status || "",
      approvalStatus: r.adGroupAd?.policySummary?.approvalStatus || "",
      impressions: parseInt(r.metrics.impressions || "0"),
      clicks: parseInt(r.metrics.clicks || "0"),
      ctr: r.metrics.ctr || 0,
      spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
      conversions: parseFloat(r.metrics.conversions || "0"),
    };
  });
}

// --- Account validation ---

/**
 * Validates that we can actually query a customer account via the Google Ads API.
 * This catches the MCC mismatch problem early: OAuth works (listAccessibleCustomers
 * only needs OAuth), but googleAds:search also validates the developer token,
 * which must belong to an MCC that manages this customer account.
 *
 * Returns { valid: true } or { valid: false, error: GadsError }.
 */
export async function validateAccountAccess(
  customerId: string,
  accessToken: string,
  loginCustomerId?: string | null
): Promise<{ valid: true } | { valid: false; error: GadsError }> {
  validateEnvVars();
  const cleanId = customerId.replace(/-/g, "");
  log.info("Validando acesso a conta Google Ads", { customerId: cleanId, loginCustomerId });

  try {
    await gadsFetch(
      customerId,
      accessToken,
      "/googleAds:search",
      {
        method: "POST",
        body: JSON.stringify({
          query: "SELECT customer.descriptive_name FROM customer LIMIT 1",
        }),
      },
      loginCustomerId || undefined
    );
    log.info("Validação OK — acesso confirmado", { customerId: cleanId });
    return { valid: true };
  } catch (err) {
    const errStr = String(err);
    const parsedError = parseGoogleAdsError(errStr);
    log.warn("Validação falhou — sem acesso a conta", {
      customerId: cleanId,
      loginCustomerId,
      errorCode: parsedError.code,
      errorMessage: parsedError.message,
      rawError: errStr.slice(0, 500),
    });
    return { valid: false, error: parsedError };
  }
}

