import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { runAutomations } from "@/lib/automations/engine";
import type { ExecutionContext, KeywordTriggerConfig } from "@/lib/automations/types";

const log = createLogger("whatsapp/webhook");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/webhook");
  try {
    const body = await req.json();

    // Only process incoming messages
    if (body.event !== "messages.upsert") {
      log.debug("Evento ignorado", { event: body.event });
      return Response.json({ ok: true });
    }

    const fromMe = body.data?.key?.fromMe;
    if (fromMe) {
      log.debug("Mensagem enviada por mim, ignorando");
      return Response.json({ ok: true });
    }

    const instanceName = body.instance as string | undefined;
    if (!instanceName) {
      log.warn("Webhook sem instanceName");
      return Response.json({ ok: true });
    }

    // Lookup userId from instance
    const connection = await prisma.whatsappConnection.findFirst({
      where: { instanceName },
    });
    if (!connection) {
      log.warn("Conexão não encontrada para instância", { instanceName });
      return Response.json({ ok: true });
    }
    const userId = connection.userId;

    // Extract message data
    const remoteJid: string = body.data?.key?.remoteJid ?? "";
    const phone = remoteJid.replace("@s.whatsapp.net", "");
    const messageText: string =
      body.data?.message?.conversation ??
      body.data?.message?.extendedTextMessage?.text ??
      "";
    const pushName: string = body.data?.pushName ?? "Desconhecido";

    if (!phone || !messageText) {
      log.debug("Mensagem sem telefone ou texto, ignorando", { phone, messageText });
      return Response.json({ ok: true });
    }

    log.info("Mensagem recebida", { phone, pushName, userId });

    // Find or create lead
    let lead = await prisma.lead.findFirst({
      where: { phone, userId },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name: pushName,
          phone,
          origin: "whatsapp",
          stage: "lead",
          userId,
        },
      });
      log.info("Lead criado via WhatsApp", { leadId: lead.id, name: pushName, phone });
    } else if (pushName && pushName !== "Desconhecido" && pushName !== phone && lead.name === phone) {
      // Update lead name if we now have a real pushName
      await prisma.lead.update({
        where: { id: lead.id },
        data: { name: pushName },
      });
      lead = { ...lead, name: pushName };
    }

    // Deduplication: check if identical message exists in last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const duplicate = await prisma.message.findFirst({
      where: {
        leadId: lead.id,
        content: messageText,
        fromMe: false,
        timestamp: { gte: fiveSecondsAgo },
      },
    });

    if (duplicate) {
      log.debug("Mensagem duplicada ignorada", { leadId: lead.id, content: messageText });
      return Response.json({ ok: true });
    }

    // Create message record
    await prisma.message.create({
      data: {
        content: messageText,
        fromMe: false,
        leadId: lead.id,
      },
    });

    // Update lastMessageAt
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastMessageAt: new Date() },
    });

    // Run keyword automations
    try {
      const context: ExecutionContext = {
        userId,
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          stage: lead.stage,
        },
        incomingMessage: messageText,
        senderPhone: phone,
      };

      await runAutomations("keyword", userId, context, (triggerConfig) => {
        const config = triggerConfig as KeywordTriggerConfig;
        const keywords: string[] = config.keywords ?? [];
        const lowerMessage = messageText.toLowerCase();
        return keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()));
      });
    } catch (err) {
      log.error("Erro ao executar automações", { error: String(err) });
    }

    return Response.json({ ok: true });
  } catch (err) {
    log.error("Erro no webhook", { error: String(err) });
    // Always return 200 to prevent Evolution API retries
    return Response.json({ ok: true });
  }
}
