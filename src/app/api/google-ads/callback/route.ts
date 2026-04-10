import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, listAccessibleAccounts } from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/callback");

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  log.info("GET /api/google-ads/callback", { hasCode: !!code, hasState: !!state, error });

  if (error || !code || !state) {
    log.warn("OAuth negado ou parâmetros ausentes", { error });
    redirect("/settings?error=google-ads-denied");
  }

  let userId: string;
  try {
    const payload = jwt.verify(state, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
    };
    userId = payload.userId;
    log.debug("State verificado", { userId });
  } catch {
    log.error("State JWT inválido ou expirado");
    redirect("/settings?error=google-ads-invalid-state");
  }

  try {
    log.debug("Trocando code por tokens");
    const tokens = await exchangeCodeForTokens(code);
    log.debug("Tokens obtidos, listando contas");
    const accounts = await listAccessibleAccounts(tokens.access_token);
    log.info("Contas Google Ads encontradas", { count: accounts.length });

    if (accounts.length === 0) {
      log.warn("Nenhuma conta Google Ads acessível");
      redirect("/settings?error=google-ads-no-accounts");
    }

    const customerId = accounts[0];
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleAdsConnection.upsert({
      where: { userId },
      create: {
        userId,
        customerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
      update: {
        customerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
    });

    log.info("Google Ads conectado com sucesso", { userId, customerId });
  } catch (err) {
    const errorMsg = String(err);
    log.error("Erro no OAuth Google Ads", { error: errorMsg });
    const detail = encodeURIComponent(errorMsg.slice(0, 300));
    redirect(`/settings?error=google-ads-failed&detail=${detail}`);
  }

  redirect("/settings?connected=google-ads");
}
