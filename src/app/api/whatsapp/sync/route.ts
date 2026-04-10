import { requireAuth } from "@/lib/auth";
import { fetchMessages } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/sync");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/sync");
  try {
    const session = await requireAuth();
    const { leadId } = await req.json();

    if (!leadId) {
      return Response.json({ error: "leadId é obrigatório" }, { status: 400 });
    }

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection || connection.status !== "connected") {
      return Response.json(
        { error: "WhatsApp não está conectado" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        userId: session.role === "admin" ? undefined : session.id,
      },
    });

    if (!lead || !lead.phone) {
      log.warn("Lead sem telefone", { leadId });
      return Response.json(
        { error: "Lead não encontrado ou sem telefone" },
        { status: 404 }
      );
    }

    // Buscar mensagens da Evolution API
    const phone = lead.phone.replace(/\D/g, "");
    log.info("Sincronizando mensagens", { leadId, phone, instance: connection.instanceName });

    const result = await fetchMessages(connection.instanceName, phone);

    // result pode ser array direto ou { messages: [...] }
    const rawMessages: Array<Record<string, unknown>> = Array.isArray(result)
      ? result
      : result?.messages ?? result?.data ?? [];

    log.info("Mensagens recebidas da Evolution API", { count: rawMessages.length });

    let synced = 0;

    for (const msg of rawMessages) {
      // Extrair dados da mensagem
      const key = msg.key as Record<string, unknown> | undefined;
      const fromMe = key?.fromMe === true;
      const content =
        (msg.message as Record<string, unknown>)?.conversation as string ??
        ((msg.message as Record<string, unknown>)?.extendedTextMessage as Record<string, unknown>)?.text as string ??
        null;

      if (!content) continue;

      // Timestamp: Evolution retorna em segundos (epoch)
      const messageTimestamp = msg.messageTimestamp as number | string | undefined;
      const timestamp = messageTimestamp
        ? new Date(Number(messageTimestamp) * (Number(messageTimestamp) > 1e12 ? 1 : 1000))
        : new Date();

      // Deduplicar: verificar se mensagem com mesmo conteúdo e timestamp próximo já existe
      const windowStart = new Date(timestamp.getTime() - 2000);
      const windowEnd = new Date(timestamp.getTime() + 2000);

      const existing = await prisma.message.findFirst({
        where: {
          leadId,
          content,
          fromMe,
          timestamp: { gte: windowStart, lte: windowEnd },
        },
      });

      if (!existing) {
        await prisma.message.create({
          data: {
            content,
            fromMe,
            timestamp,
            leadId,
          },
        });
        synced++;
      }
    }

    // Atualizar lastMessageAt do lead
    if (synced > 0) {
      const lastMsg = await prisma.message.findFirst({
        where: { leadId },
        orderBy: { timestamp: "desc" },
      });
      if (lastMsg) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { lastMessageAt: lastMsg.timestamp },
        });
      }
    }

    log.info("Sincronização concluída", { leadId, total: rawMessages.length, synced });
    return Response.json({ total: rawMessages.length, synced });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao sincronizar mensagens", { error: msg });
    return Response.json(
      { error: "Falha ao sincronizar mensagens", details: msg },
      { status: 500 }
    );
  }
}
