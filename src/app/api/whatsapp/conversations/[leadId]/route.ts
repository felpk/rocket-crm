import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/conversations");

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  log.info("DELETE /api/whatsapp/conversations/[leadId]");
  try {
    const session = await requireAuth();
    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        userId: session.role === "admin" ? undefined : session.id,
      },
    });

    if (!lead) {
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    // Delete all messages for this lead
    const deleted = await prisma.message.deleteMany({
      where: { leadId },
    });

    // Reset lastMessageAt
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastMessageAt: null },
    });

    log.info("Conversa deletada", { leadId, messagesDeleted: deleted.count });
    return Response.json({ ok: true, messagesDeleted: deleted.count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao deletar conversa", { error: msg });
    return Response.json({ error: "Falha ao deletar conversa", details: msg }, { status: 500 });
  }
}
