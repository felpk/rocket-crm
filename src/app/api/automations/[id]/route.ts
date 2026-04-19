import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("automations/[id]");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("PATCH /api/automations/" + id);
  try {
    const session = await requireAuth();

    const automation = await prisma.automation.findUnique({ where: { id } });
    if (!automation) {
      log.warn("Automação não encontrada", { id });
      return Response.json({ error: "Automação não encontrada" }, { status: 404 });
    }
    if (session.role !== "admin" && automation.userId !== session.id) {
      log.warn("Sem permissão para editar automação", { id, userId: session.id });
      return Response.json({ error: "Sem permissão" }, { status: 403 });
    }

    const data = await req.json();

    const updated = await prisma.automation.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
        ...(data.triggerConfig !== undefined && {
          triggerConfig: JSON.stringify(data.triggerConfig),
        }),
        ...(data.actions !== undefined && {
          actions: JSON.stringify(data.actions),
        }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    log.info("Automação atualizada", { id, changes: Object.keys(data) });
    return Response.json({
      ...updated,
      triggerConfig: JSON.parse(updated.triggerConfig),
      actions: JSON.parse(updated.actions),
    });
  } catch (err) {
    log.error("Erro ao atualizar automação", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("DELETE /api/automations/" + id);
  try {
    const session = await requireAuth();

    const automation = await prisma.automation.findUnique({ where: { id } });
    if (!automation) {
      log.warn("Automação não encontrada para exclusão", { id });
      return Response.json({ error: "Automação não encontrada" }, { status: 404 });
    }
    if (session.role !== "admin" && automation.userId !== session.id) {
      log.warn("Sem permissão para excluir automação", { id, userId: session.id });
      return Response.json({ error: "Sem permissão" }, { status: 403 });
    }

    await prisma.automation.delete({ where: { id } });
    log.info("Automação excluída", { id });
    return Response.json({ ok: true });
  } catch (err) {
    log.error("Erro ao excluir automação", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
