import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("dashboard");

export async function GET() {
  log.info("GET /api/dashboard");
  try {
    const session = await requireAuth();
    const isAdmin = session.role === "admin";
    const whereUser = isAdmin ? {} : { userId: session.id };

    // Date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalLeads,
      newLeadsToday,
      newLeadsThisWeek,
      newLeadsThisMonth,
      totalConversions,
      funnelValueResult,
      closedValueResult,
      stagesRaw,
      originsRaw,
      recentLeadsRaw,
      leadsLast30Days,
      activeAutomations,
      recentAutomationLogsRaw,
      whatsappConnection,
      googleAdsConnection,
      totalMessages,
      messagesSentToday,
    ] = await Promise.all([
      // 1. Total leads
      prisma.lead.count({ where: whereUser }),

      // 2. New leads today
      prisma.lead.count({
        where: { ...whereUser, createdAt: { gte: todayStart } },
      }),

      // 3. New leads this week
      prisma.lead.count({
        where: { ...whereUser, createdAt: { gte: weekStart } },
      }),

      // 4. New leads this month
      prisma.lead.count({
        where: { ...whereUser, createdAt: { gte: monthStart } },
      }),

      // 5. Total conversions (closed stage)
      prisma.lead.count({
        where: { ...whereUser, stage: "closed" },
      }),

      // 6. Total funnel value (all leads)
      prisma.lead.aggregate({
        where: whereUser,
        _sum: { value: true },
      }),

      // 7. Closed value
      prisma.lead.aggregate({
        where: { ...whereUser, stage: "closed" },
        _sum: { value: true },
      }),

      // 8. Leads grouped by stage
      prisma.lead.groupBy({
        by: ["stage"],
        where: whereUser,
        _count: true,
        _sum: { value: true },
      }),

      // 9. Leads grouped by origin
      prisma.lead.groupBy({
        by: ["origin"],
        where: whereUser,
        _count: true,
      }),

      // 10. Recent 5 leads
      prisma.lead.findMany({
        where: whereUser,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          company: true,
          stage: true,
          value: true,
          createdAt: true,
        },
      }),

      // 11. Leads created in last 30 days (for daily trend)
      prisma.lead.findMany({
        where: { ...whereUser, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // 12. Active automations count
      prisma.automation.count({
        where: { ...whereUser, active: true },
      }),

      // 13. Recent 5 automation logs
      prisma.automationLog.findMany({
        where: isAdmin
          ? {}
          : { automation: { userId: session.id } },
        orderBy: { executedAt: "desc" },
        take: 5,
        select: {
          status: true,
          details: true,
          executedAt: true,
          automation: { select: { name: true } },
        },
      }),

      // 14. WhatsApp connection status
      prisma.whatsappConnection.findUnique({
        where: { userId: session.id },
        select: { status: true },
      }),

      // 15. Google Ads connection status
      prisma.googleAdsConnection.findUnique({
        where: { userId: session.id },
        select: { accountName: true },
      }),

      // 16. Total messages
      prisma.message.count({
        where: isAdmin
          ? {}
          : { lead: { userId: session.id } },
      }),

      // 17. Messages sent today
      prisma.message.count({
        where: {
          ...(isAdmin ? {} : { lead: { userId: session.id } }),
          timestamp: { gte: todayStart },
        },
      }),
    ]);

    // Build daily leads trend (group by date in JS since SQLite lacks DATE_TRUNC)
    const dailyLeadsMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      dailyLeadsMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const lead of leadsLast30Days) {
      const dateKey = lead.createdAt.toISOString().slice(0, 10);
      dailyLeadsMap.set(dateKey, (dailyLeadsMap.get(dateKey) || 0) + 1);
    }
    const dailyLeads = Array.from(dailyLeadsMap.entries()).map(
      ([date, count]) => ({ date, count })
    );

    // Format stages
    const stages = stagesRaw.map((s) => ({
      stage: s.stage,
      count: s._count,
      value: s._sum.value || 0,
    }));

    // Format origins with percentage
    const totalOriginCount = originsRaw.reduce((sum, o) => sum + o._count, 0);
    const origins = originsRaw.map((o) => ({
      origin: o.origin || "desconhecido",
      count: o._count,
      percentage: totalOriginCount > 0 ? (o._count / totalOriginCount) * 100 : 0,
    }));

    // Format recent leads
    const recentLeads = recentLeadsRaw.map((l) => ({
      id: l.id,
      name: l.name,
      company: l.company,
      stage: l.stage,
      value: l.value,
      createdAt: l.createdAt,
    }));

    // Format automation logs
    const recentAutomationLogs = recentAutomationLogsRaw.map((l) => ({
      status: l.status,
      details: l.details,
      executedAt: l.executedAt,
      automationName: l.automation.name,
    }));

    const funnelValue = funnelValueResult._sum.value || 0;
    const closedValue = closedValueResult._sum.value || 0;
    const conversionRate =
      totalLeads > 0
        ? Math.round((totalConversions / totalLeads) * 10000) / 100
        : 0;

    const data = {
      // KPIs
      totalLeads,
      newLeadsToday,
      newLeadsThisWeek,
      newLeadsThisMonth,
      totalConversions,
      conversionRate,
      funnelValue,
      closedValue,

      // Funnel stages breakdown
      stages,

      // Lead origin distribution
      origins,

      // Recent leads
      recentLeads,

      // Daily trend (last 30 days)
      dailyLeads,

      // Automations summary
      activeAutomations,
      recentAutomationLogs,

      // Integration status
      whatsappConnected: whatsappConnection?.status === "connected",
      googleAdsConnected: googleAdsConnection !== null,
      googleAdsAccountName: googleAdsConnection?.accountName ?? null,

      // Message stats
      totalMessages,
      messagesSentToday,
    };

    log.info("Dashboard carregado", {
      userId: session.id,
      isAdmin,
      totalLeads,
      totalConversions,
    });

    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Unauthorized") {
      log.warn("Acesso nao autorizado ao dashboard");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    log.error("Erro ao carregar dashboard", { error: message });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
