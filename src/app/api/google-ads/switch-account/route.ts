import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { validateAccountAccess } from "@/lib/google-ads";

const log = createLogger("google-ads/switch-account");

export async function POST(req: Request) {
  log.debug("POST /api/google-ads/switch-account");
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { customerId } = body;

    if (!customerId) {
      return Response.json({ error: "customerId obrigatorio" }, { status: 400 });
    }

    const connection = await prisma.googleAdsConnection.findUnique({
      where: { userId: session.id },
      select: {
        managedAccounts: true,
        loginCustomerId: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiry: true,
      },
    });

    if (!connection) {
      log.warn("Google Ads não conectado", { userId: session.id });
      return Response.json({ error: "Google Ads não conectado" }, { status: 404 });
    }

    const managedAccounts = connection.managedAccounts
      ? JSON.parse(connection.managedAccounts as string)
      : [];

    const account = managedAccounts.find(
      (a: { id: string; name: string }) => a.id === customerId
    );

    if (!account) {
      log.warn("Conta não encontrada na lista", { userId: session.id, customerId });
      return Response.json(
        { error: "Conta não encontrada na lista de contas gerenciadas" },
        { status: 400 }
      );
    }

    try {
      await validateAccountAccess(
        customerId,
        connection.accessToken,
        connection.loginCustomerId
      );
    } catch (validationErr) {
      log.warn("Falha na validacao de acesso", {
        userId: session.id,
        customerId,
        error: String(validationErr),
      });
      return Response.json(
        { error: String(validationErr) },
        { status: 400 }
      );
    }

    const accountName = account.name;

    await prisma.googleAdsConnection.update({
      where: { userId: session.id },
      data: {
        customerId,
        accountName,
        lastSyncAt: null,
      },
    });

    log.info("Conta Google Ads alterada", {
      userId: session.id,
      customerId,
      accountName,
    });

    return Response.json({ success: true, customerId, accountName });
  } catch (err) {
    log.error("Erro ao trocar conta Google Ads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
