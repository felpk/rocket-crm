import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  listAccessibleAccounts,
  isManagerAccount,
  listManagedAccounts,
  validateAccountAccess,
  GADS_ERROR_CODES,
} from "@/lib/google-ads";
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

    // Detect if the first account is an MCC (manager account)
    let customerId = accounts[0];
    let loginCustomerId: string | null = null;

    const isMcc = await isManagerAccount(customerId, tokens.access_token);
    if (isMcc) {
      log.info("Conta é MCC, buscando contas gerenciadas", { mccId: customerId });
      const managed = await listManagedAccounts(customerId, tokens.access_token);
      const clientAccounts = managed.filter((a) => !a.isManager);
      log.info("Contas cliente encontradas", {
        total: managed.length,
        clients: clientAccounts.length,
      });

      if (clientAccounts.length === 0) {
        log.warn("MCC sem contas cliente");
        redirect("/settings?error=google-ads-no-client-accounts");
      }

      loginCustomerId = customerId; // MCC ID for the login-customer-id header
      customerId = clientAccounts[0].id; // Use the first client account
      log.info("Usando conta cliente do MCC", {
        mccId: loginCustomerId,
        clientId: customerId,
        clientName: clientAccounts[0].name,
      });
    }

    // Validate that we can actually query this account via the Google Ads API.
    // This catches the MCC mismatch problem: OAuth + listAccessibleCustomers work
    // (they only need OAuth), but googleAds:search also validates the developer token.
    // If the user's account is NOT managed by the developer token's MCC, this fails with 403.
    log.info("Validando acesso a API antes de salvar conexao", {
      customerId,
      loginCustomerId,
    });
    const validation = await validateAccountAccess(
      customerId,
      tokens.access_token,
      loginCustomerId
    );
    if (!validation.valid) {
      const errorCode = validation.error.code;
      log.error("Validacao de acesso falhou — conta nao sera salva", {
        userId,
        customerId,
        loginCustomerId,
        errorCode,
        errorMessage: validation.error.message,
      });
      const detail = encodeURIComponent(validation.error.message);
      redirect(`/settings?error=${errorCode}&detail=${detail}`);
    }

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleAdsConnection.upsert({
      where: { userId },
      create: {
        userId,
        customerId,
        loginCustomerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
      update: {
        customerId,
        loginCustomerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
    });

    log.info("Google Ads conectado com sucesso", { userId, customerId, loginCustomerId });
  } catch (err) {
    if (err instanceof Error && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const errorMsg = String(err);
    log.error("Erro no OAuth Google Ads", { error: errorMsg });
    const detail = encodeURIComponent(errorMsg.slice(0, 300));
    redirect(`/settings?error=google-ads-failed&detail=${detail}`);
  }

  redirect("/settings?connected=google-ads");
}
