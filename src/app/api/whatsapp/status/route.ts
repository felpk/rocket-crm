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
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha ao verificar conexão WhatsApp", { error: msg });
    return Response.json(
      { error: "Falha ao verificar conexão", details: msg },
      { status: 500 }
    );
  }
}
