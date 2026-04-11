/**
 * Script para investigar o erro 403 de permissão na conta Google Ads do Pedro.
 *
 * Testa:
 * 1. Busca dados do Pedro no banco (User + GoogleAdsConnection)
 * 2. Renova o access token usando o refresh_token
 * 3. Chama listAccessibleCustomers (só precisa OAuth)
 * 4. Chama googleAds:search SEM login-customer-id (deve dar 403?)
 * 5. Chama googleAds:search COM login-customer-id = customerId
 * 6. Tenta detectar se a conta é MCC
 *
 * Hipótese: o developer token foi criado num MCC específico.
 * Se o Pedro não está vinculado a esse MCC, o developer token não tem
 * permissão para acessar as contas dele — daí o 403.
 *
 * Uso:
 *   npx tsx scripts/test-pedro-connection.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const API_BASE = "https://googleads.googleapis.com/v20";

function separator(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

async function refreshAccessToken(rt: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: rt,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("FALHA ao renovar token:", JSON.stringify(data, null, 2));
    throw new Error("Token refresh failed");
  }
  console.log("Token renovado com sucesso");
  console.log(`  expires_in: ${data.expires_in}s`);
  console.log(`  scope: ${data.scope}`);
  return data.access_token as string;
}

async function callListAccessibleCustomers(accessToken: string) {
  separator("TEST: customers:listAccessibleCustomers");
  console.log("(Esse endpoint só precisa de OAuth + developer-token, sem customer ID)");

  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
    },
  });
  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

async function callGoogleAdsSearch(
  customerId: string,
  accessToken: string,
  loginCustomerId: string | null,
  label: string
) {
  separator(`TEST: googleAds:search — ${label}`);

  const query = `SELECT customer.descriptive_name, customer.id, customer.manager FROM customer LIMIT 1`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
  };

  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
    console.log(`login-customer-id header: ${headers["login-customer-id"]}`);
  } else {
    console.log("login-customer-id header: NOT SET");
  }

  console.log(`customer ID in URL: ${customerId}`);
  console.log(`Query: ${query.trim()}`);

  const res = await fetch(
    `${API_BASE}/customers/${customerId.replace(/-/g, "")}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    }
  );

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(`Status: ${res.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

async function callCampaignSearch(
  customerId: string,
  accessToken: string,
  loginCustomerId: string | null,
  label: string
) {
  separator(`TEST: campaign query — ${label}`);

  const query = `
    SELECT campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros
    FROM campaign
    ORDER BY metrics.impressions DESC
    LIMIT 5
  `;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
  };

  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
    console.log(`login-customer-id header: ${headers["login-customer-id"]}`);
  } else {
    console.log("login-customer-id header: NOT SET");
  }

  console.log(`customer ID in URL: ${customerId}`);

  const res = await fetch(
    `${API_BASE}/customers/${customerId.replace(/-/g, "")}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query: query.trim() }),
    }
  );

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(`Status: ${res.status}`);
  console.log("Response:", JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

async function main() {
  separator("ENVIRONMENT CHECK");
  console.log(`DEVELOPER_TOKEN: ${DEVELOPER_TOKEN ? DEVELOPER_TOKEN.slice(0, 8) + "..." : "MISSING"}`);
  console.log(`CLIENT_ID: ${CLIENT_ID ? CLIENT_ID.slice(0, 20) + "..." : "MISSING"}`);
  console.log(`CLIENT_SECRET: ${CLIENT_SECRET ? "SET" : "MISSING"}`);

  // -------------------------------------------------------
  separator("DATABASE: All Users");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: true,
      createdAt: true,
    },
  });
  for (const u of users) {
    console.log(`  [${u.role}] ${u.name} <${u.email}> (${u.id}) company=${u.company || "N/A"} created=${u.createdAt.toISOString()}`);
  }

  // -------------------------------------------------------
  separator("DATABASE: All GoogleAdsConnections");
  const connections = await prisma.googleAdsConnection.findMany({
    include: { user: { select: { name: true, email: true } } },
  });

  if (connections.length === 0) {
    console.log("Nenhuma conexao Google Ads encontrada no banco.");
    await prisma.$disconnect();
    return;
  }

  for (const c of connections) {
    console.log(`  User: ${c.user.name} <${c.user.email}>`);
    console.log(`    Connection ID: ${c.id}`);
    console.log(`    Customer ID: ${c.customerId}`);
    console.log(`    Login Customer ID (MCC): ${c.loginCustomerId || "N/A"}`);
    console.log(`    Account Name: ${c.accountName || "N/A"}`);
    console.log(`    Token Expiry: ${c.tokenExpiry.toISOString()}`);
    console.log(`    Last Sync: ${c.lastSyncAt?.toISOString() || "never"}`);
    console.log(`    Refresh Token: ${c.refreshToken ? c.refreshToken.slice(0, 20) + "..." : "MISSING"}`);
    console.log(`    Created: ${c.createdAt.toISOString()}`);
  }

  // Find Pedro's connection (look for name containing "Pedro" or just use first connection)
  const pedroConnection =
    connections.find((c) => c.user.name.toLowerCase().includes("pedro")) ||
    connections[0];

  separator(`TESTING CONNECTION: ${pedroConnection.user.name} (${pedroConnection.customerId})`);

  // -------------------------------------------------------
  separator("STEP 1: Refresh Access Token");
  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(pedroConnection.refreshToken);
  } catch {
    console.log("FALHA: Nao foi possivel renovar o token. O refresh_token pode estar revogado.");
    await prisma.$disconnect();
    return;
  }

  // -------------------------------------------------------
  // STEP 2: listAccessibleCustomers
  const listResult = await callListAccessibleCustomers(accessToken);

  // -------------------------------------------------------
  // STEP 3: googleAds:search WITHOUT login-customer-id
  const searchNoLogin = await callGoogleAdsSearch(
    pedroConnection.customerId,
    accessToken,
    null,
    "SEM login-customer-id"
  );

  // -------------------------------------------------------
  // STEP 4: googleAds:search WITH login-customer-id = customerId
  const searchWithLogin = await callGoogleAdsSearch(
    pedroConnection.customerId,
    accessToken,
    pedroConnection.customerId,
    "COM login-customer-id = customerId"
  );

  // -------------------------------------------------------
  // STEP 5: If loginCustomerId is set in DB, try with that
  if (pedroConnection.loginCustomerId && pedroConnection.loginCustomerId !== pedroConnection.customerId) {
    await callGoogleAdsSearch(
      pedroConnection.customerId,
      accessToken,
      pedroConnection.loginCustomerId,
      `COM login-customer-id = loginCustomerId (${pedroConnection.loginCustomerId})`
    );
  }

  // -------------------------------------------------------
  // STEP 6: Campaign query (what the app actually calls)
  await callCampaignSearch(
    pedroConnection.customerId,
    accessToken,
    pedroConnection.loginCustomerId,
    "campaign query (como o app faz)"
  );

  // -------------------------------------------------------
  // STEP 7: If listAccessibleCustomers returned multiple accounts,
  // try each one to find which works
  if (listResult.status === 200 && listResult.data.resourceNames?.length > 1) {
    separator("TESTING ALL ACCESSIBLE ACCOUNTS");
    const accountIds: string[] = listResult.data.resourceNames.map((r: string) =>
      r.replace("customers/", "")
    );
    console.log(`Found ${accountIds.length} accessible accounts: ${accountIds.join(", ")}`);

    for (const acctId of accountIds) {
      if (acctId === pedroConnection.customerId.replace(/-/g, "")) continue;
      console.log(`\n--- Testing account ${acctId} ---`);

      // Try as login-customer-id for Pedro's customerId
      const res = await callGoogleAdsSearch(
        pedroConnection.customerId,
        accessToken,
        acctId,
        `login-customer-id=${acctId}, target=${pedroConnection.customerId}`
      );

      // Also try querying this account directly
      if (res.status !== 200) {
        await callGoogleAdsSearch(
          acctId,
          accessToken,
          acctId,
          `querying account ${acctId} directly`
        );
      }
    }
  }

  // -------------------------------------------------------
  separator("ANALYSIS / CONCLUSION");

  const listOk = listResult.status === 200;
  const searchNoLoginOk = searchNoLogin.status === 200;
  const searchWithLoginOk = searchWithLogin.status === 200;

  console.log(`listAccessibleCustomers: ${listOk ? "OK (200)" : `FAILED (${listResult.status})`}`);
  console.log(`googleAds:search sem login-customer-id: ${searchNoLoginOk ? "OK (200)" : `FAILED (${searchNoLogin.status})`}`);
  console.log(`googleAds:search com login-customer-id: ${searchWithLoginOk ? "OK (200)" : `FAILED (${searchWithLogin.status})`}`);

  if (listOk && !searchNoLoginOk && !searchWithLoginOk) {
    console.log(`
CONCLUSAO: O erro 403 confirma a hipotese de MCC/developer token mismatch.

O developer token foi criado em um MCC especifico. O Pedro consegue listar
contas (listAccessibleCustomers funciona com qualquer developer token valido),
mas nao consegue consultar dados (googleAds:search) porque o developer token
so tem permissao para acessar contas vinculadas ao MCC onde foi criado.

SOLUCOES POSSIVEIS:
1. Adicionar a conta do Pedro como sub-conta do MCC onde o developer token foi criado
2. Usar o developer token do MCC do Pedro (se ele tiver um)
3. Solicitar um developer token com acesso "Standard" (nao vinculado a um MCC especifico)
4. Vincular o MCC do developer token como gerenciador da conta do Pedro
`);
  } else if (listOk && !searchNoLoginOk && searchWithLoginOk) {
    console.log(`
CONCLUSAO: O login-customer-id resolve o problema!

A conta do Pedro pode ser uma sub-conta de um MCC. Quando nao envia
login-customer-id, a API nao sabe qual MCC usar para autenticar.
Ao enviar login-customer-id = customerId, funciona.

ACAO: Verificar se o app esta enviando o login-customer-id corretamente.
`);
  } else if (listOk && searchNoLoginOk) {
    console.log(`
CONCLUSAO: As chamadas estao funcionando agora!

Pode ter sido um problema temporario, ou o token anterior estava expirado.
Monitorar para ver se o erro volta.
`);
  } else if (!listOk) {
    console.log(`
CONCLUSAO: Ate o listAccessibleCustomers falhou.

Isso sugere um problema mais fundamental:
- Developer token invalido ou nao aprovado
- Refresh token revogado
- Credenciais OAuth incorretas
`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Erro fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
