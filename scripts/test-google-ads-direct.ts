/**
 * Script para testar a API do Google Ads diretamente.
 *
 * Uso:
 *   npx tsx scripts/test-google-ads-direct.ts
 *
 * Requer que o usuário já tenha feito o OAuth flow pelo menos uma vez.
 * Busca o refresh_token salvo no banco e faz as chamadas diretas.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "";
const API_BASE = "https://googleads.googleapis.com/v23";

async function refreshToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("❌ Erro ao renovar token:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data.access_token as string;
}

async function listAccounts(accessToken: string) {
  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
    },
  });
  const data = await res.json();
  console.log("\n=== CONTAS ACESSÍVEIS ===");
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function getAccountSummary(customerId: string, accessToken: string, loginCustomerId?: string | null) {
  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros
    FROM customer
  `;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(`${API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  console.log("\n=== RESUMO DA CONTA (ALL TIME) ===");
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function getCampaigns(customerId: string, accessToken: string, loginCustomerId?: string | null) {
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
    ORDER BY metrics.impressions DESC
  `;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(`${API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  console.log("\n=== CAMPANHAS (ALL TIME) ===");
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  // Try to get connection from DB
  const connection = await prisma.googleAdsConnection.findFirst();

  if (!connection) {
    console.log("❌ Nenhuma conexão Google Ads encontrada no banco.");
    console.log("   Faça o OAuth flow primeiro: login no CRM → Settings → Connect Google Ads");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("✅ Conexão encontrada:");
  console.log(`   Customer ID: ${connection.customerId}`);
  console.log(`   Login Customer ID (MCC): ${connection.loginCustomerId || "N/A (acesso direto)"}`);
  console.log(`   Token expira: ${connection.tokenExpiry}`);

  // Refresh the access token
  console.log("\n🔄 Renovando access token...");
  const accessToken = await refreshToken(connection.refreshToken);
  console.log("✅ Token renovado com sucesso");

  // Make API calls
  await listAccounts(accessToken);
  await getAccountSummary(connection.customerId, accessToken, connection.loginCustomerId);
  await getCampaigns(connection.customerId, accessToken, connection.loginCustomerId);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
