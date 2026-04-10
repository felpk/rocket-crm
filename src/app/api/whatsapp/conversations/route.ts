import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/conversations");

export async function GET() {
  log.info("GET /api/whatsapp/conversations");
  try {
    const session = await requireAuth();

    const userFilter = session.role === "admin" ? undefined : session.id;

    // 1. Leads with messages (conversations) — ordered by last message
    const leadsWithMessages = await prisma.lead.findMany({
      where: {
        userId: userFilter,
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

    // 2. Leads with phone but NO messages (contacts) — ordered by name
    const leadsWithPhone = await prisma.lead.findMany({
      where: {
        userId: userFilter,
        phone: { not: null },
        messages: { none: {} },
      },
      orderBy: { name: "asc" },
    });

    const conversations = leadsWithMessages.map((lead) => ({
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

    const contacts = leadsWithPhone.map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      stage: lead.stage,
      lastMessage: null,
      messageCount: 0,
    }));

    log.info("Conversas e contatos listados", { conversations: conversations.length, contacts: contacts.length });
    return Response.json({ conversations, contacts });
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
