import { requireAuth } from "@/lib/auth";
import { getValidToken, getCampaignMetrics, parseGoogleAdsError } from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/campaigns");

export async function GET(req: Request) {
  log.info("GET /api/google-ads/campaigns");
  try {
    const session = await requireAuth();
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");

    const userId =
      session.role === "admin" && targetUserId ? targetUserId : session.id;

    log.debug("Buscando token Google Ads", { userId });
    const token = await getValidToken(userId);
    if (!token) {
      log.warn("Google Ads não conectado", { userId });
      return Response.json(
        { error: "Google Ads não conectado" },
        { status: 404 }
      );
    }

    const campaigns = await getCampaignMetrics(
      token.customerId,
      token.accessToken
    );
    log.info("Campanhas carregadas", { count: campaigns.length });
    return Response.json(campaigns);
  } catch (error) {
    const details = String(error);
    log.error("Falha ao buscar campanhas", { error: details });

    const userMessage = parseGoogleAdsError(details);
    return Response.json(
      { error: userMessage, details },
      { status: 500 }
    );
  }
}
