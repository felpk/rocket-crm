import { requireAuth } from "@/lib/auth";
import {
  getValidToken,
  getAccountSummary,
  parseGoogleAdsError,
  refreshAndRetry,
} from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/summary");

export async function GET(req: Request) {
  log.info("GET /api/google-ads/summary");

  let session;
  try {
    session = await requireAuth();
  } catch {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");

    const userId =
      session.role === "admin" && targetUserId ? targetUserId : session.id;

    const token = await getValidToken(userId);
    if (!token) {
      log.warn("Google Ads não conectado", { userId });
      return Response.json(
        { error: "Google Ads não conectado" },
        { status: 404 }
      );
    }

    try {
      const summary = await getAccountSummary(
        token.customerId,
        token.accessToken
      );
      log.info("Summary carregado", summary);
      return Response.json(summary);
    } catch (apiError) {
      const errStr = String(apiError);
      if (errStr.includes("401") || errStr.includes("UNAUTHENTICATED")) {
        log.warn("Token inválido, tentando renovar", { userId });
        const result = await refreshAndRetry(userId, (newToken) =>
          getAccountSummary(token.customerId, newToken)
        );
        if (result) {
          log.info("Summary carregado após renovação", result);
          return Response.json(result);
        }
        return Response.json(
          { error: "Google Ads desconectado. Token expirado — reconecte nas configurações." },
          { status: 401 }
        );
      }
      throw apiError;
    }
  } catch (error) {
    const details = String(error);
    log.error("Falha ao buscar métricas", { error: details });

    const userMessage = parseGoogleAdsError(details);
    return Response.json({ error: userMessage, details }, { status: 500 });
  }
}
