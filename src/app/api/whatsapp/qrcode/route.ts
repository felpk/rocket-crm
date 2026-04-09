import { requireAuth } from "@/lib/auth";
import { getQrCode } from "@/lib/evolution";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/qrcode");

export async function GET() {
  log.info("GET /api/whatsapp/qrcode");
  try {
    await requireAuth();
    const qr = await getQrCode();
    log.debug("Resposta do Evolution API", { keys: Object.keys(qr), hasBase64: !!qr.base64 });

    // Evolution API v2 retorna base64 ou qrcode dependendo da versão
    const base64 = qr.base64 || qr.qrcode;
    if (!base64) {
      log.warn("QR Code não encontrado na resposta", { response: JSON.stringify(qr).slice(0, 500) });
      return Response.json(
        { error: "QR Code não disponível. Verifique se a instância existe e não está já conectada." },
        { status: 422 }
      );
    }

    log.info("QR Code gerado com sucesso");
    return Response.json({ base64 });
  } catch (error) {
    log.error("Falha ao gerar QR Code", { error: String(error) });
    return Response.json(
      { error: "Falha ao gerar QR Code", details: String(error) },
      { status: 500 }
    );
  }
}
