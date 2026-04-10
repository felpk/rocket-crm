import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/messages");

export async function GET(req: Request) {
  log.info("GET /api/whatsapp/messages");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return Response.json({ error: "leadId é obrigatório" }, { status: 400 });
    }

    // Verificar que o lead pertence ao usuário
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        userId: session.role === "admin" ? undefined : session.id,
      },
    });

    if (!lead) {
      log.warn("Lead não encontrado", { leadId, userId: session.id });
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { timestamp: "asc" },
    });

    log.info("Mensagens carregadas", { leadId, count: messages.length });
    return Response.json({ lead, messages });
  } catch (error) {
    log.error("Falha ao buscar mensagens", { error: String(error) });
    return Response.json(
      { error: "Falha ao buscar mensagens", details: String(error) },
      { status: 500 }
    );
  }
}
