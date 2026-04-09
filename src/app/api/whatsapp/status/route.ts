import { requireAuth } from "@/lib/auth";
import { getConnectionState } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/status");

export async function GET() {
  log.info("GET /api/whatsapp/status");
  try {
    const session = await requireAuth();

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection) {
      log.info("Usuário sem instância WhatsApp", { userId: session.id });
      return Response.json({
        instance: { instanceName: null, state: "disconnected" },
      });
    }

    const state = await getConnectionState(connection.instanceName);
    log.info("Estado da conexão WhatsApp", { instanceName: connection.instanceName, state });

    // Sincronizar status no DB
    const newStatus = state?.instance?.state === "open" ? "connected" : "disconnected";
    if (connection.status !== newStatus) {
      await prisma.whatsappConnection.update({
        where: { userId: session.id },
        data: { status: newStatus },
      });
    }

    return Response.json(state);
  } catch (error) {
    log.error("Falha ao verificar conexão WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao verificar conexão", details: String(error) },
      { status: 500 }
    );
  }
}
