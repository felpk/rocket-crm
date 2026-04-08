import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/status");

export async function GET() {
  log.debug("GET /api/google-ads/status");
  try {
    const session = await requireAuth();

    const connection = await prisma.googleAdsConnection.findUnique({
      where: { userId: session.id },
      select: { customerId: true, accountName: true },
    });

    if (!connection) {
      log.debug("Google Ads não conectado", { userId: session.id });
      return Response.json({ connected: false });
    }

    log.debug("Google Ads conectado", { userId: session.id, customerId: connection.customerId });
    return Response.json({
      connected: true,
      customerId: connection.customerId,
      accountName: connection.accountName,
    });
  } catch (err) {
    log.error("Erro ao verificar status Google Ads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
