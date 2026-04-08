import { requireAuth } from "@/lib/auth";
import { sendTextMessage } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/send");

export async function POST(req: Request) {
  log.info("POST /api/whatsapp/send");
  try {
    await requireAuth();
    const { phone, text, leadId } = await req.json();

    if (!phone || !text) {
      log.warn("Campos obrigatórios ausentes", { phone: !!phone, text: !!text });
      return Response.json(
        { error: "Telefone e texto são obrigatórios" },
        { status: 400 }
      );
    }

    log.debug("Enviando mensagem", { phone, leadId, textLength: text.length });
    const result = await sendTextMessage(phone, text);

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
