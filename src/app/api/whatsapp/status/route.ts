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
      log.info("Nenhuma instância configurada", { userId: session.id });
      return Response.json({ instance: null, status: "no_instance" });
    }

    try {
      const state = await getConnectionState(connection.instanceName);
      log.info("Estado da conexão WhatsApp", {
        userId: session.id,
        instanceName: connection.instanceName,
        state,
      });

      // Update status in DB if changed
      const newStatus = state?.instance?.state === "open" ? "connected" : "disconnected";
      if (connection.status !== newStatus) {
        await prisma.whatsappConnection.update({
          where: { id: connection.id },
          data: { status: newStatus },
        });
        log.info("Status atualizado no banco", {
          instanceName: connection.instanceName,
          oldStatus: connection.status,
          newStatus,
        });
      }

      return Response.json(state);
    } catch (error) {
      log.warn("Falha ao consultar Evolution API, instância pode não existir", {
        instanceName: connection.instanceName,
        error: String(error),
      });
      return Response.json({
        instance: { instanceName: connection.instanceName, state: "disconnected" },
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao verificar conexão WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao verificar conexão", details: String(error) },
      { status: 500 }
    );
  }
}
