import { requireAuth } from "@/lib/auth";
import { createInstance, getQrCode, makeInstanceName, setWebhook } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/qrcode");

export async function GET() {
  log.info("GET /api/whatsapp/qrcode");
  try {
    const session = await requireAuth();

    // Buscar ou criar instância do usuário
    let connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    const instanceName = connection?.instanceName ?? makeInstanceName(session.id);

    if (!connection) {
      log.info("Criando instância para usuário", { userId: session.id, instanceName });
      try {
        const created = await createInstance(instanceName);
        log.debug("Resposta createInstance", { keys: Object.keys(created) });

        connection = await prisma.whatsappConnection.create({
          data: {
            instanceName,
            status: "disconnected",
            userId: session.id,
          },
        });

        // Configurar webhook para receber eventos
        const webhookUrl = `${process.env.NEXTAUTH_URL}/api/whatsapp/webhook`;
        await setWebhook(instanceName, webhookUrl).catch(err =>
          log.warn("Falha ao configurar webhook", { error: String(err) })
        );

        // createInstance retorna qrcode como objeto { base64, code, count }
        const base64 = created.base64 || created.qrcode?.base64;
        if (base64) {
          log.info("QR Code retornado na criação da instância");
          return Response.json({ base64 });
        }
      } catch (error) {
        // Se a instância já existe no Evolution API, continua para buscar QR
        const msg = String(error);
        if (msg.includes("already") || msg.includes("409")) {
          log.warn("Instância já existe no Evolution API, buscando QR", { instanceName });
          // Criar registro no DB se não existe
          connection = await prisma.whatsappConnection.upsert({
            where: { userId: session.id },
            update: {},
            create: {
              instanceName,
              status: "disconnected",
              userId: session.id,
            },
          });
        } else {
          throw error;
        }
      }
    }

    // Buscar QR Code da instância existente
    const qr = await getQrCode(instanceName);
    log.debug("Resposta getQrCode", { keys: Object.keys(qr), hasBase64: !!qr.base64 });

    const base64 = qr.base64 || qr.qrcode?.base64;
    if (!base64) {
      log.warn("QR Code não encontrado na resposta", { response: JSON.stringify(qr).slice(0, 500) });
      return Response.json(
        { error: "QR Code não disponível. A instância pode já estar conectada." },
        { status: 422 }
      );
    }

    log.info("QR Code gerado com sucesso", { instanceName });
    return Response.json({ base64 });
  } catch (error) {
    log.error("Falha ao gerar QR Code", { error: String(error) });
    return Response.json(
      { error: "Falha ao gerar QR Code", details: String(error) },
      { status: 500 }
    );
  }
}
