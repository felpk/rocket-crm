import { requireAuth } from "@/lib/auth";
import { sendTextMessage } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/send");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/send");
  try {
    const session = await requireAuth();
    const { phone, text, leadId } = await req.json();

    if (!phone || !text) {
      log.warn("Campos obrigatórios ausentes", { phone: !!phone, text: !!text });
      return Response.json(
        { error: "Telefone e texto são obrigatórios" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection || connection.status !== "connected") {
      log.warn("WhatsApp não conectado", { userId: session.id, status: connection?.status });
      return Response.json(
        { error: "WhatsApp não está conectado. Conecte primeiro na página do WhatsApp." },
        { status: 400 }
      );
    }

    // Resolve lead: use provided leadId, or find/create by phone
    let resolvedLeadId = leadId;

    if (!resolvedLeadId) {
      let lead = await prisma.lead.findFirst({
        where: { phone: cleanPhone, userId: session.id },
      });

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            name: cleanPhone,
            phone: cleanPhone,
            origin: "whatsapp",
            stage: "lead",
            userId: session.id,
          },
        });
        log.info("Lead criado via envio WhatsApp", { leadId: lead.id, phone: cleanPhone });
      }

      resolvedLeadId = lead.id;
    }

    log.debug("Enviando mensagem", { instanceName: connection.instanceName, phone: cleanPhone, leadId: resolvedLeadId, textLength: text.length });
    const result = await sendTextMessage(connection.instanceName, cleanPhone, text);

    // Save message and update lastMessageAt
    const now = new Date();
    await prisma.message.create({
      data: { content: text, fromMe: true, timestamp: now, leadId: resolvedLeadId },
    });

    await prisma.lead.update({
      where: { id: resolvedLeadId },
      data: { lastMessageAt: now },
    });

    log.info("Mensagem enviada e salva", { phone: cleanPhone, leadId: resolvedLeadId });
    return Response.json({ ...result, leadId: resolvedLeadId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao enviar mensagem WhatsApp", { error: msg });
    return Response.json(
      { error: "Falha ao enviar mensagem", details: msg },
      { status: 500 }
    );
  }
}
