import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("automations/[id]/logs");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("GET /api/automations/" + id + "/logs");
  try {
    const session = await requireAuth();

    // Check ownership
    const automation = await prisma.automation.findUnique({ where: { id } });
    if (!automation) {
      log.warn("Automacao nao encontrada", { id });
      return Response.json({ error: "Automacao nao encontrada" }, { status: 404 });
    }
    if (session.role !== "admin" && automation.userId !== session.id) {
      log.warn("Sem permissao para ver logs", { id, userId: session.id });
      return Response.json({ error: "Sem permissao" }, { status: 403 });
    }

    const logs = await prisma.automationLog.findMany({
      where: { automationId: id },
      orderBy: { executedAt: "desc" },
      take: 50,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
      },
    });

    log.info("Logs listados", { automationId: id, count: logs.length });
    return Response.json(logs);
  } catch (err) {
    log.error("Erro ao listar logs", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
