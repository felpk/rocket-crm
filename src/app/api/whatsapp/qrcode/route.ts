import { requireAuth } from "@/lib/auth";
import { getQrCode } from "@/lib/evolution";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/qrcode");

export async function GET() {
  log.info("GET /api/whatsapp/qrcode");
  try {
    await requireAuth();
    const qr = await getQrCode();
    log.info("QR Code gerado com sucesso");
    return Response.json(qr);
  } catch (error) {
    log.error("Falha ao gerar QR Code", { error: String(error) });
    return Response.json(
      { error: "Falha ao gerar QR Code", details: String(error) },
      { status: 500 }
    );
  }
}
