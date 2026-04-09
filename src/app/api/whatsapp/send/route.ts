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

    log.debug("Enviando mensagem", { instanceName: connection.instanceName, phone, leadId, textLength: text.length });
    const result = await sendTextMessage(connection.instanceName, phone, text);

    if (leadId) {
      await prisma.message.create({
        data: { content: text, fromMe: true, leadId },
      });
      log.debug("Mensagem salva no histórico do lead", { leadId });
    }

    log.info("Mensagem enviada com sucesso", { phone });
    return Response.json(result);
  } catch (error) {
    log.error("Falha ao enviar mensagem WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao enviar mensagem", details: String(error) },
      { status: 500 }
    );
  }
}
