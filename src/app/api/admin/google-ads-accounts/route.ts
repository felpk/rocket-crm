import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getValidToken, listManagedAccounts } from "@/lib/google-ads";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin/google-ads-accounts");

/**
 * GET — List all MCC managed accounts + which client each is assigned to.
 * Uses the admin's own GoogleAdsConnection (must be connected to MCC).
 */
export async function GET() {
  log.info("GET /api/admin/google-ads-accounts");

  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    // Find admin user
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });
    if (!admin) {
      return Response.json({ error: "Admin não encontrado" }, { status: 404 });
    }

    const adminConnection = await prisma.googleAdsConnection.findUnique({
      where: { userId: admin.id },
    });
    if (!adminConnection) {
      return Response.json({
        connected: false,
        accounts: [],
        assignments: [],
      });
    }

    // Get managed accounts — prefer fresh API call, fallback to cached
    let managedAccounts: Array<{ id: string; name: string }> = [];

    const token = await getValidToken(admin.id);
    if (token && adminConnection.loginCustomerId) {
      try {
        const fresh = await listManagedAccounts(
          adminConnection.loginCustomerId,
          token.accessToken
        );
        managedAccounts = fresh
          .filter(a => !a.isManager)
          .map(a => ({ id: a.id, name: a.name }));

        // Update cache
        await prisma.googleAdsConnection.update({
          where: { userId: admin.id },
          data: { managedAccounts: JSON.stringify(managedAccounts) },
        });
      } catch (err) {
        log.warn("Falha ao listar contas do MCC, usando cache", { error: String(err) });
      }
    }

    // Fallback to cached
    if (managedAccounts.length === 0 && adminConnection.managedAccounts) {
      managedAccounts = JSON.parse(adminConnection.managedAccounts);
    }

    // Get all client assignments
    const clientConnections = await prisma.googleAdsConnection.findMany({
      where: {
        user: { role: "client" },
      },
      select: {
        customerId: true,
        accountName: true,
        userId: true,
        user: { select: { id: true, name: true, email: true, company: true } },
      },
    });

    const assignments = clientConnections.map(c => ({
      customerId: c.customerId,
      accountName: c.accountName,
      userId: c.user.id,
      userName: c.user.name,
      userEmail: c.user.email,
      userCompany: c.user.company,
    }));

    log.info("Contas listadas", { accounts: managedAccounts.length, assignments: assignments.length });

    return Response.json({
      connected: true,
      mccId: adminConnection.loginCustomerId || adminConnection.customerId,
      accounts: managedAccounts,
      assignments,
    });
  } catch (error) {
    log.error("Erro ao listar contas", { error: String(error) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * POST — Assign a Google Ads account to a client.
 * Creates a GoogleAdsConnection for the client using the admin's MCC tokens.
 *
 * Body: { userId: string, customerId: string }
 * To unassign: { userId: string, customerId: null }
 */
export async function POST(req: Request) {
  log.info("POST /api/admin/google-ads-accounts");

  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, customerId } = body;

    if (!userId) {
      return Response.json({ error: "userId obrigatório" }, { status: 400 });
    }

    // Verify client exists
    const client = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
    if (!client || client.role !== "client") {
      return Response.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Unassign
    if (!customerId) {
      await prisma.googleAdsConnection.deleteMany({
        where: { userId },
      });
      log.info("Google Ads desatribuido", { userId, clientName: client.name });
      return Response.json({ success: true, action: "unassigned" });
    }

    // Find admin connection for tokens
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });
    if (!admin) {
      return Response.json({ error: "Admin não encontrado" }, { status: 404 });
    }

    const adminConnection = await prisma.googleAdsConnection.findUnique({
      where: { userId: admin.id },
    });
    if (!adminConnection) {
      return Response.json({ error: "Admin não conectou Google Ads" }, { status: 400 });
    }

    // Find account name from managed accounts
    let accountName = customerId;
    if (adminConnection.managedAccounts) {
      const managed = JSON.parse(adminConnection.managedAccounts) as Array<{ id: string; name: string }>;
      const found = managed.find(a => a.id === customerId);
      if (found) accountName = found.name;
    }

    // Create/update client's connection using admin's tokens
    await prisma.googleAdsConnection.upsert({
      where: { userId },
      create: {
        userId,
        customerId,
        loginCustomerId: adminConnection.loginCustomerId || adminConnection.customerId,
        accessToken: adminConnection.accessToken,
        refreshToken: adminConnection.refreshToken,
        tokenExpiry: adminConnection.tokenExpiry,
        accountName,
      },
      update: {
        customerId,
        loginCustomerId: adminConnection.loginCustomerId || adminConnection.customerId,
        accessToken: adminConnection.accessToken,
        refreshToken: adminConnection.refreshToken,
        tokenExpiry: adminConnection.tokenExpiry,
        accountName,
        lastSyncAt: null,
      },
    });

    log.info("Google Ads atribuido", { userId, clientName: client.name, customerId, accountName });
    return Response.json({ success: true, action: "assigned", customerId, accountName });
  } catch (error) {
    log.error("Erro ao atribuir conta", { error: String(error) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
