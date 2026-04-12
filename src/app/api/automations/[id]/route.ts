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
      log.warn("Automacao nao encontrada", { id });
      return Response.json({ error: "Automacao nao encontrada" }, { status: 404 });
    }
    if (session.role !== "admin" && automation.userId !== session.id) {
      log.warn("Sem permissao para editar automacao", { id, userId: session.id });
      return Response.json({ error: "Sem permissao" }, { status: 403 });
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

    log.info("Automacao atualizada", { id, changes: Object.keys(data) });
    return Response.json({
      ...updated,
      triggerConfig: JSON.parse(updated.triggerConfig),
      actions: JSON.parse(updated.actions),
    });
  } catch (err) {
    log.error("Erro ao atualizar automacao", { id, error: String(err) });
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
      log.warn("Automacao nao encontrada para exclusao", { id });
      return Response.json({ error: "Automacao nao encontrada" }, { status: 404 });
    }
    if (session.role !== "admin" && automation.userId !== session.id) {
      log.warn("Sem permissao para excluir automacao", { id, userId: session.id });
      return Response.json({ error: "Sem permissao" }, { status: 403 });
    }

    await prisma.automation.delete({ where: { id } });
    log.info("Automacao excluida", { id });
    return Response.json({ ok: true });
  } catch (err) {
    log.error("Erro ao excluir automacao", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
