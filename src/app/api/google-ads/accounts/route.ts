import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/accounts");

export async function GET() {
  log.debug("GET /api/google-ads/accounts");
  try {
    const session = await requireAuth();

    if (process.env.GOOGLE_ADS_DEMO === "true") {
      const { getDemoAccounts } = await import("@/lib/google-ads-demo");
      log.debug("Modo demo ativo", { userId: session.id });
      return Response.json({
        accounts: getDemoAccounts(),
        currentCustomerId: "1234567890",
      });
    }

    const connection = await prisma.googleAdsConnection.findUnique({
      where: { userId: session.id },
      select: { customerId: true, managedAccounts: true },
    });

    if (!connection) {
      log.warn("Google Ads nao conectado", { userId: session.id });
      return Response.json({ error: "Google Ads nao conectado" }, { status: 404 });
    }

    if (!connection.managedAccounts) {
      log.debug("Sem contas gerenciadas", { userId: session.id });
      return Response.json({
        accounts: [],
        currentCustomerId: connection.customerId,
      });
    }

    const accounts = JSON.parse(connection.managedAccounts as string);
    log.debug("Contas encontradas", { userId: session.id, count: accounts.length });
    return Response.json({
      accounts,
      currentCustomerId: connection.customerId,
    });
  } catch (err) {
    log.error("Erro ao listar contas Google Ads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
