import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin/stats");

export async function GET() {
  log.info("GET /api/admin/stats");
  try {
    await requireAdmin();

    const [totalClients, totalLeads, totalAutomations] = await Promise.all([
      prisma.user.count({ where: { role: "client" } }),
      prisma.lead.count(),
      prisma.automation.count({ where: { active: true } }),
    ]);

    const leadsByStage = await prisma.lead.groupBy({
      by: ["stage"],
      _count: true,
      _sum: { value: true },
    });

    log.info("Stats carregados", { totalClients, totalLeads, totalAutomations });
    return Response.json({
      totalClients,
      totalLeads,
      totalAutomations,
      leadsByStage,
    });
  } catch (err) {
    log.error("Erro ao carregar stats", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
