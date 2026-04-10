import { requireAuth } from "@/lib/auth";
import { sendTextMessage } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { normalizePhone } from "@/lib/utils";

const log = createLogger("whatsapp/send");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/send");
  try {
    const session = await requireAuth();
    const { leadId, text } = await req.json();

    if (!leadId || !text) {
      log.warn("Campos obrigatórios ausentes", {
        leadId: !!leadId,
        text: !!text,
      });
      return Response.json(
        { error: "leadId e texto são obrigatórios" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) {
      log.warn("Lead não encontrado", { leadId });
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    if (session.role !== "admin" && lead.userId !== session.id) {
      log.warn("Acesso negado ao lead", { leadId, userId: session.id });
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (!lead.phone) {
      log.warn("Lead sem telefone", { leadId });
      return Response.json(
        { error: "Lead não tem telefone cadastrado" },
        { status: 400 }
      );
    }

    // Get user's WhatsApp instance
    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: lead.userId },
    });

    if (!connection || connection.status !== "connected") {
      log.warn("WhatsApp não conectado para este usuário", {
        leadId,
        userId: lead.userId,
        connectionStatus: connection?.status,
      });
      return Response.json(
        { error: "WhatsApp não está conectado" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(lead.phone);
    log.debug("Enviando mensagem", {
      phone,
      leadId,
      instanceName: connection.instanceName,
      textLength: text.length,
    });

    const result = await sendTextMessage(connection.instanceName, phone, text);

    const message = await prisma.message.create({
      data: {
        content: text,
        fromMe: true,
        remoteJid: `${phone}@s.whatsapp.net`,
        leadId,
      },
    });

    log.info("Mensagem enviada e salva", {
      phone,
      leadId,
      messageId: message.id,
      instanceName: connection.instanceName,
    });
    return Response.json({ ...result, messageId: message.id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      log.warn("Acesso não autorizado");
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao enviar mensagem WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao enviar mensagem", details: String(error) },
      { status: 500 }
    );
  }
}
