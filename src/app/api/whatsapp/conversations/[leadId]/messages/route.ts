import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/messages");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  log.info("GET /api/whatsapp/conversations/[leadId]/messages", { leadId });
  try {
    const session = await requireAuth();
    const isAdmin = session.role === "admin";

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) {
      log.warn("Lead não encontrado", { leadId });
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    if (!isAdmin && lead.userId !== session.id) {
      log.warn("Acesso negado ao lead", { leadId, userId: session.id });
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { timestamp: "asc" },
    });

    log.info("Mensagens listadas", { leadId, total: messages.length });
    return Response.json({ lead, messages });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      log.warn("Acesso não autorizado a mensagens");
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao listar mensagens", {
      leadId,
      error: String(error),
    });
    return Response.json(
      { error: "Falha ao listar mensagens", details: String(error) },
      { status: 500 }
    );
  }
}
