import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getValidToken,
  getRecommendations,
  parseGoogleAdsError,
  refreshAndRetry,
  parseDateRange,
} from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/recommendations");

export async function GET(req: Request) {
  log.info("GET /api/google-ads/recommendations");

  let session;
  try {
    session = await requireAuth();
  } catch {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    if (process.env.GOOGLE_ADS_DEMO === "true") {
      log.info("Modo demo ativo");
      const data = await getRecommendations("demo", "demo");
      return Response.json(data);
    }

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");
    const dateRange = parseDateRange(url.searchParams.get("dateRange"));

    const userId =
      session.role === "admin" && targetUserId ? targetUserId : session.id;

    const token = await getValidToken(userId);
    if (!token) {
      return Response.json({ error: "Google Ads não conectado" }, { status: 404 });
    }

    try {
      const data = await getRecommendations(
        token.customerId,
        token.accessToken,
        dateRange,
        token.loginCustomerId
      );
      await prisma.googleAdsConnection.update({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });
      return Response.json(data);
    } catch (apiError) {
      const errStr = String(apiError);
      if (errStr.includes("401") || errStr.includes("UNAUTHENTICATED")) {
        const result = await refreshAndRetry(userId, (newToken) =>
          getRecommendations(token.customerId, newToken, dateRange, token.loginCustomerId)
        );
        if (result) {
          await prisma.googleAdsConnection.update({
            where: { userId },
            data: { lastSyncAt: new Date() },
          });
          return Response.json(result);
        }
        return Response.json(
          { error: "Token expirado - reconecte nas configurações." },
          { status: 401 }
        );
      }
      throw apiError;
    }
  } catch (error) {
    const details = String(error);
    log.error("Falha ao buscar dados", { error: details });
    const parsed = parseGoogleAdsError(details);
    return Response.json({ error: parsed.message, errorCode: parsed.code, details }, { status: 500 });
  }
}
