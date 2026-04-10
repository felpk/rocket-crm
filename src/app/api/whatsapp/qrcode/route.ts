import { requireAuth } from "@/lib/auth";
import { getQrCode } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/qrcode");

export async function GET() {
  log.info("GET /api/whatsapp/qrcode");
  try {
    const session = await requireAuth();

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection) {
      log.warn("Nenhuma instância para gerar QR", { userId: session.id });
      return Response.json(
        { error: "Nenhuma instância WhatsApp configurada. Conecte primeiro." },
        { status: 400 }
      );
    }

    const qr = await getQrCode(connection.instanceName);
    log.info("QR Code gerado com sucesso", {
      instanceName: connection.instanceName,
    });
    return Response.json(qr);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao gerar QR Code", { error: String(error) });
    return Response.json(
      { error: "Falha ao gerar QR Code", details: String(error) },
      { status: 500 }
    );
  }
}
