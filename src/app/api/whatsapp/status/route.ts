import { requireAuth } from "@/lib/auth";
import { getConnectionState } from "@/lib/evolution";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/status");

export async function GET() {
  log.info("GET /api/whatsapp/status");
  try {
    await requireAuth();
    const state = await getConnectionState();
    log.info("Estado da conexão WhatsApp", state);
    return Response.json(state);
  } catch (error) {
    log.error("Falha ao verificar conexão WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao verificar conexão", details: String(error) },
      { status: 500 }
    );
  }
}
