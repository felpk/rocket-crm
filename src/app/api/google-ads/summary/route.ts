import { requireAuth } from "@/lib/auth";
import { getValidToken, getAccountSummary, parseGoogleAdsError } from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/summary");

export async function GET(req: Request) {
  log.info("GET /api/google-ads/summary");
  try {
    const session = await requireAuth();
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

    const summary = await getAccountSummary(
      token.customerId,
      token.accessToken
    );
    log.info("Summary carregado", summary);
    return Response.json(summary);
  } catch (error) {
    const details = String(error);
    log.error("Falha ao buscar métricas", { error: details });

    // Detect common Google Ads issues and return user-friendly messages
    const userMessage = parseGoogleAdsError(details);
    return Response.json(
      { error: userMessage, details },
      { status: 500 }
    );
  }
}
