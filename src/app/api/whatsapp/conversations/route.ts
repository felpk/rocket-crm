import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/conversations");

export async function GET() {
  log.info("GET /api/whatsapp/conversations");
  try {
    const session = await requireAuth();

    // Buscar leads que têm mensagens, ordenados pela última mensagem
    const leads = await prisma.lead.findMany({
      where: {
        userId: session.role === "admin" ? undefined : session.id,
        messages: { some: {} },
      },
      include: {
        messages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const conversations = leads.map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      stage: lead.stage,
      lastMessage: lead.messages[0]
        ? {
            content: lead.messages[0].content,
            fromMe: lead.messages[0].fromMe,
            timestamp: lead.messages[0].timestamp,
          }
        : null,
      messageCount: lead._count.messages,
    }));

    log.info("Conversas listadas", { count: conversations.length });
    return Response.json(conversations);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao listar conversas", { error: msg });
    return Response.json(
      { error: "Falha ao listar conversas", details: msg },
      { status: 500 }
    );
  }
}
