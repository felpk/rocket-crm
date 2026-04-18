import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/status");

export async function GET() {
  log.debug("GET /api/google-ads/status");
  try {
    const session = await requireAuth();

    if (process.env.GOOGLE_ADS_DEMO === "true") {
      log.debug("Modo demo ativo", { userId: session.id });
      return Response.json({
        connected: true,
        customerId: "000-000-0000",
        accountName: "Conta Demo",
        lastSyncAt: new Date().toISOString(),
        connectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        hasManagedAccounts: true,
      });
    }

    const connection = await prisma.googleAdsConnection.findUnique({
      where: { userId: session.id },
      select: { customerId: true, accountName: true, loginCustomerId: true, managedAccounts: true, lastSyncAt: true, createdAt: true },
    });

    if (!connection) {
      log.debug("Google Ads não conectado", { userId: session.id });
      return Response.json({ connected: false });
    }

    // Detect if this was assigned by admin (client shares MCC tokens)
    let assignedByAdmin = false;
    if (session.role === "client" && connection.loginCustomerId) {
      const adminConnection = await prisma.googleAdsConnection.findFirst({
        where: {
          user: { role: "admin" },
          loginCustomerId: connection.loginCustomerId,
        },
        select: { id: true },
      });
      assignedByAdmin = !!adminConnection;
    }

    log.debug("Google Ads conectado", { userId: session.id, customerId: connection.customerId, assignedByAdmin });
    return Response.json({
      connected: true,
      assignedByAdmin,
      customerId: connection.customerId,
      accountName: connection.accountName,
      lastSyncAt: connection.lastSyncAt,
      connectedAt: connection.createdAt,
      hasManagedAccounts: !!connection.managedAccounts,
    });
  } catch (err) {
    log.error("Erro ao verificar status Google Ads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
