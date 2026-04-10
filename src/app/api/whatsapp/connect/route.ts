import { requireAuth } from "@/lib/auth";
import { createInstance, deleteInstance, setWebhook } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/connect");

// POST — create instance and connect
export async function POST() {
  log.info("POST /api/whatsapp/connect");
  try {
    const session = await requireAuth();

    // Check if user already has a connection
    const existing = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (existing) {
      log.info("Instância já existe", {
        userId: session.id,
        instanceName: existing.instanceName,
      });
      return Response.json({
        instanceName: existing.instanceName,
        status: existing.status,
        message: "Instância já existe. Use o QR Code para conectar.",
      });
    }

    // Generate unique instance name based on user id
    const instanceName = `rocket-${session.id}`;

    // Build webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const webhookUrl = webhookSecret
      ? `${baseUrl}/api/whatsapp/webhook?secret=${webhookSecret}`
      : undefined;

    if (!webhookSecret) {
      log.warn("WEBHOOK_SECRET não configurado — webhook não será registrado");
    }

    // Create instance on Evolution API
    log.info("Criando instância na Evolution API", { instanceName });
    const result = await createInstance(instanceName, webhookUrl);

    // If webhook wasn't set during creation, set it now
    if (webhookUrl && !result?.webhook) {
      try {
        await setWebhook(instanceName, webhookUrl);
        log.info("Webhook configurado", { instanceName, webhookUrl });
      } catch (err) {
        log.warn("Falha ao configurar webhook separadamente", {
          instanceName,
          error: String(err),
        });
      }
    }

    // Save connection to DB
    const connection = await prisma.whatsappConnection.create({
      data: {
        instanceName,
        status: "disconnected",
        userId: session.id,
      },
    });

    log.info("Instância criada e salva", {
      connectionId: connection.id,
      instanceName,
      userId: session.id,
    });

    return Response.json({
      instanceName: connection.instanceName,
      status: connection.status,
      qrcode: result?.qrcode,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao criar instância WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao criar instância", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE — disconnect and remove instance
export async function DELETE() {
  log.info("DELETE /api/whatsapp/connect");
  try {
    const session = await requireAuth();

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection) {
      log.warn("Nenhuma instância para desconectar", { userId: session.id });
      return Response.json(
        { error: "Nenhuma instância WhatsApp encontrada" },
        { status: 404 }
      );
    }

    // Delete from Evolution API
    try {
      await deleteInstance(connection.instanceName);
      log.info("Instância deletada da Evolution API", {
        instanceName: connection.instanceName,
      });
    } catch (err) {
      log.warn("Falha ao deletar instância da Evolution API (pode já não existir)", {
        instanceName: connection.instanceName,
        error: String(err),
      });
    }

    // Remove from DB
    await prisma.whatsappConnection.delete({
      where: { id: connection.id },
    });

    log.info("Conexão WhatsApp removida", {
      userId: session.id,
      instanceName: connection.instanceName,
    });

    return Response.json({ status: "disconnected" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }
    log.error("Falha ao desconectar WhatsApp", { error: String(error) });
    return Response.json(
      { error: "Falha ao desconectar", details: String(error) },
      { status: 500 }
    );
  }
}
