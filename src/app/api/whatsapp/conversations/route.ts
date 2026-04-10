import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/conversations");

export async function GET() {
  log.info("GET /api/whatsapp/conversations");
  try {
    const session = await requireAuth();
    const isAdmin = session.role === "admin";

    const leads = await prisma.lead.findMany({
      where: {
        phone: { not: null },
        ...(isAdmin ? {} : { userId: session.id }),
      },
      include: {
        messages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    const conversations = leads
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        lastMessage: lead.messages[0]?.content || null,
        lastMessageAt: lead.messages[0]?.timestamp || lead.createdAt,
        lastMessageFromMe: lead.messages[0]?.fromMe ?? null,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );

    log.info("Conversas listadas", {
      userId: session.id,
      total: conversations.length,
    });
    return Response.json(conversations);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      log.warn("Acesso não autorizado a conversas");
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao listar conversas", { error: String(error) });
    return Response.json(
      { error: "Falha ao listar conversas", details: String(error) },
      { status: 500 }
    );
  }
}
