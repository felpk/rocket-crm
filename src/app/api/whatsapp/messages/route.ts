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
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao buscar mensagens", { error: msg });
    return Response.json(
      { error: "Falha ao buscar mensagens", details: msg },
      { status: 500 }
    );
  }
}
