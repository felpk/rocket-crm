import { prisma } from "./db";
import { createLogger } from "./logger";

const log = createLogger("google-ads");

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI || "";
const API_BASE = "https://googleads.googleapis.com/v20";
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
          ? "CAUSA: conta Google Ads nao ativada. Usuario precisa finalizar setup em ads.google.com (ToS + billing)."
          : "PROVAVEL CAUSA: developer token nao tem permissao para esta conta, ou conta nao esta ativada. " +
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

export async function getCampaignMetrics(
  customerId: string,
  accessToken: string,
  dateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    log.info("Modo demo ativo — retornando campanhas fictícias");
    return getDemoCampaigns();
  }

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
    ${dateRange !== "ALL_TIME" ? `WHERE segments.date DURING ${dateRange}` : ""}
    ORDER BY metrics.impressions DESC
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

  const results = data.results || [];
  return results.map(
    (r: {
      campaign: { name: string; status: string };
      metrics: {
        impressions: string;
        clicks: string;
        ctr: number;
        averageCpc: string;
        costMicros: string;
      };
    }) => ({
      name: r.campaign.name,
      status: r.campaign.status,
      impressions: parseInt(r.metrics.impressions || "0"),
      clicks: parseInt(r.metrics.clicks || "0"),
      ctr: r.metrics.ctr || 0,
      cpc: parseInt(r.metrics.averageCpc || "0") / 1_000_000,
      spend: parseInt(r.metrics.costMicros || "0") / 1_000_000,
    })
  );
}

export async function getAccountSummary(
  customerId: string,
  accessToken: string,
  dateRange = "ALL_TIME",
  loginCustomerId?: string | null
) {
  if (process.env.GOOGLE_ADS_DEMO === "true") {
    log.info("Modo demo ativo — retornando summary fictício");
    return getDemoSummary();
  }

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros
    FROM customer
    ${dateRange !== "ALL_TIME" ? `WHERE segments.date DURING ${dateRange}` : ""}
  `;

  const data = await gadsFetch(customerId, accessToken, "/googleAds:search", {
    method: "POST",
    body: JSON.stringify({ query }),
  }, loginCustomerId || undefined);

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
    log.info("Validacao OK — acesso confirmado", { customerId: cleanId });
    return { valid: true };
  } catch (err) {
    const errStr = String(err);
    const parsedError = parseGoogleAdsError(errStr);
    log.warn("Validacao falhou — sem acesso a conta", {
      customerId: cleanId,
      loginCustomerId,
      errorCode: parsedError.code,
      errorMessage: parsedError.message,
      rawError: errStr.slice(0, 500),
    });
    return { valid: false, error: parsedError };
  }
}

// --- Demo mode ---

function getDemoCampaigns() {
  return [
    {
      name: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      status: "ENABLED",
      impressions: 18420,
      clicks: 1253,
      ctr: 0.068,
      cpc: 2.87,
      spend: 3596.11,
    },
    {
      name: "Implantes Fortaleza",
      status: "ENABLED",
      impressions: 12350,
      clicks: 876,
      ctr: 0.0709,
      cpc: 3.12,
      spend: 2733.12,
    },
    {
      name: "Clínica Sorriso — Lentes de Contato",
      status: "ENABLED",
      impressions: 9870,
      clicks: 542,
      ctr: 0.0549,
      cpc: 4.15,
      spend: 2249.30,
    },
    {
      name: "Curso de Violão 3.0",
      status: "PAUSED",
      impressions: 3210,
      clicks: 198,
      ctr: 0.0617,
      cpc: 1.45,
      spend: 287.10,
    },
    {
      name: "Kickboxing em casa | Guia",
      status: "PAUSED",
      impressions: 1540,
      clicks: 87,
      ctr: 0.0565,
      cpc: 0.92,
      spend: 80.04,
    },
  ];
}

function getDemoSummary() {
  const campaigns = getDemoCampaigns();
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    spend,
  };
}
