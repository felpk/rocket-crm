import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/disconnect");

export async function POST() {
  log.info("POST /api/google-ads/disconnect");
  try {
    const session = await requireAuth();

    await prisma.googleAdsConnection.deleteMany({
      where: { userId: session.id },
    });

    log.info("Google Ads desconectado", { userId: session.id });
    return Response.json({ success: true });
  } catch (err) {
    log.error("Erro ao desconectar Google Ads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
