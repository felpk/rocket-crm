import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getValidToken,
  getAccountSummary,
  parseGoogleAdsError,
  refreshAndRetry,
  parseDateRange,
} from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/summary");

export async function GET(req: Request) {
  log.info("GET /api/google-ads/summary");

  let session;
  try {
    session = await requireAuth();
  } catch {
    return Response.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    // Demo mode — return demo data without DB/API calls
    if (process.env.GOOGLE_ADS_DEMO === "true") {
      log.info("Modo demo ativo — retornando summary demo");
      const summary = await getAccountSummary("demo", "demo");
      return Response.json(summary);
    }

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");
    const dateRange = parseDateRange(url.searchParams.get("dateRange"));

    const userId =
      session.role === "admin" && targetUserId ? targetUserId : session.id;

    const token = await getValidToken(userId);
    if (!token) {
      log.warn("Google Ads nao conectado", { userId });
      return Response.json(
        { error: "Google Ads nao conectado" },
        { status: 404 }
      );
    }

    const syncNow = () =>
      prisma.googleAdsConnection.update({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });

    try {
      const summary = await getAccountSummary(
        token.customerId,
        token.accessToken,
        dateRange,
        token.loginCustomerId
      );
      await syncNow();
      log.info("Summary carregado", summary);
      return Response.json(summary);
    } catch (apiError) {
      const errStr = String(apiError);
      if (errStr.includes("401") || errStr.includes("UNAUTHENTICATED")) {
        log.warn("Token invalido, tentando renovar", { userId });
        const result = await refreshAndRetry(userId, (newToken) =>
          getAccountSummary(token.customerId, newToken, dateRange, token.loginCustomerId)
        );
        if (result) {
          await syncNow();
          log.info("Summary carregado apos renovacao", result);
          return Response.json(result);
        }
        return Response.json(
          { error: "Google Ads desconectado. Token expirado - reconecte nas configuracoes." },
          { status: 401 }
        );
      }
      throw apiError;
    }
  } catch (error) {
    const details = String(error);
    log.error("Falha ao buscar metricas", { error: details });

    const parsed = parseGoogleAdsError(details);
    log.error("Erro parseado para o usuario", { errorCode: parsed.code, errorMessage: parsed.message });
    return Response.json({ error: parsed.message, errorCode: parsed.code, details }, { status: 500 });
  }
}
