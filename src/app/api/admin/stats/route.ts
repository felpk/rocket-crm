import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
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

  return Response.json({
    totalClients,
    totalLeads,
    totalAutomations,
    leadsByStage,
  });
}
