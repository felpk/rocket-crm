import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { normalizePhone } from "@/lib/utils";

const log = createLogger("whatsapp/webhook");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/webhook");

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    log.error("WEBHOOK_SECRET não configurado no .env");
    return Response.json(
      { error: "Webhook não configurado no servidor" },
      { status: 500 }
    );
  }

  if (secret !== expectedSecret) {
    log.warn("Webhook secret inválido", { received: secret });
    return Response.json({ error: "Secret inválido" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    log.debug("Webhook payload recebido", { payload });

    const event = payload.event;

    // Handle connection updates
    if (event === "connection.update") {
      const instanceName = payload.instance;
      const state = payload.data?.state;
      log.info("Connection update", { instanceName, state });

      if (instanceName && state) {
        const newStatus = state === "open" ? "connected" : "disconnected";
        try {
          await prisma.whatsappConnection.updateMany({
            where: { instanceName },
            data: { status: newStatus },
          });
          log.info("Status da conexão atualizado", { instanceName, newStatus });
        } catch (err) {
          log.error("Falha ao atualizar status da conexão", {
            instanceName,
            error: String(err),
          });
        }
      }
      return Response.json({ status: "ok", event });
    }

    if (event !== "messages.upsert") {
      log.debug("Evento ignorado", { event });
      return Response.json({ status: "ignored", event });
    }

    const data = payload.data;
    if (!data) {
      log.warn("Payload sem dados", { payload });
      return Response.json({ error: "Payload sem dados" }, { status: 400 });
    }

    const fromMe = data.key?.fromMe;
    if (fromMe) {
      log.debug("Mensagem própria ignorada");
      return Response.json({ status: "ignored", reason: "fromMe" });
    }

    const remoteJid = data.key?.remoteJid;
    if (!remoteJid || !remoteJid.endsWith("@s.whatsapp.net")) {
      log.debug("Mensagem de grupo ou status ignorada", { remoteJid });
      return Response.json({ status: "ignored", reason: "not-individual" });
    }

    // Identify which user this instance belongs to
    const instanceName = payload.instance;
    if (!instanceName) {
      log.warn("Webhook sem nome de instância", { payload });
      return Response.json(
        { error: "Instância não identificada" },
        { status: 400 }
      );
    }

    const connection = await prisma.whatsappConnection.findFirst({
      where: { instanceName },
    });

    if (!connection) {
      log.warn("Instância não encontrada no banco", { instanceName });
      return Response.json(
        { error: "Instância não registrada" },
        { status: 404 }
      );
    }

    const phone = normalizePhone(remoteJid.replace("@s.whatsapp.net", ""));
    const content =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      "[Mídia não suportada]";

    log.info("Mensagem recebida", {
      phone,
      instanceName,
      userId: connection.userId,
      contentLength: content.length,
    });

    // Find lead by phone match, scoped to the instance owner's leads
    const userLeads = await prisma.lead.findMany({
      where: { userId: connection.userId, phone: { not: null } },
      select: { id: true, phone: true },
    });

    let matchedLead = userLeads.find(
      (l) => l.phone && normalizePhone(l.phone) === phone
    );

    if (!matchedLead) {
      log.info("Lead não encontrado para o número, criando automaticamente", {
        phone,
        userId: connection.userId,
      });

      const newLead = await prisma.lead.create({
        data: {
          name: phone,
          phone,
          origin: "whatsapp",
          userId: connection.userId,
        },
      });

      log.info("Lead criado automaticamente", {
        leadId: newLead.id,
        phone,
        userId: connection.userId,
      });

      matchedLead = { id: newLead.id, phone };
    }

    const message = await prisma.message.create({
      data: {
        content,
        fromMe: false,
        remoteJid,
        leadId: matchedLead.id,
      },
    });

    log.info("Mensagem salva no banco", {
      messageId: message.id,
      leadId: matchedLead.id,
      phone,
      instanceName,
    });

    return Response.json({ status: "ok", messageId: message.id });
  } catch (error) {
    log.error("Falha ao processar webhook", { error: String(error) });
    return Response.json(
      { error: "Falha ao processar webhook", details: String(error) },
      { status: 500 }
    );
  }
}
