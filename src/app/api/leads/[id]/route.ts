import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { runAutomations } from "@/lib/automations/engine";
import type { StageChangeTriggerConfig } from "@/lib/automations/types";

const log = createLogger("leads/[id]");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("PATCH /api/leads/" + id);
  try {
    const session = await requireAuth();
    const data = await req.json();

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      log.warn("Lead não encontrado", { id });
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    if (session.role !== "admin" && lead.userId !== session.id) {
      log.warn("Sem permissão para editar lead", { id, userId: session.id });
      return Response.json({ error: "Sem permissão" }, { status: 403 });
    }

    log.debug("Atualizando lead", { id, changes: Object.keys(data) });
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.company !== undefined && { company: data.company }),
        ...(data.value !== undefined && { value: parseFloat(data.value) }),
        ...(data.origin !== undefined && { origin: data.origin }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.stage !== undefined && { stage: data.stage }),
      },
    });

    log.info("Lead atualizado", { id, stage: updated.stage });

    // Fire stage_change automations if stage changed
    if (data.stage !== undefined && data.stage !== lead.stage) {
      await Promise.race([
        runAutomations("stage_change", lead.userId, {
          lead: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, company: updated.company, stage: updated.stage },
          userId: lead.userId,
        }, (triggerConfig) => {
          const cfg = triggerConfig as StageChangeTriggerConfig;
          return cfg.toStage === data.stage && (!cfg.fromStage || cfg.fromStage === lead.stage);
        }),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]).catch(err => log.error("Automação stage_change falhou", { error: String(err) }));
    }

    return Response.json(updated);
  } catch (err) {
    log.error("Erro ao atualizar lead", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("DELETE /api/leads/" + id);
  try {
    const session = await requireAuth();

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      log.warn("Lead não encontrado para exclusão", { id });
      return Response.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    if (session.role !== "admin" && lead.userId !== session.id) {
      log.warn("Sem permissão para excluir lead", { id, userId: session.id });
      return Response.json({ error: "Sem permissão" }, { status: 403 });
    }

    await prisma.lead.delete({ where: { id } });
    log.info("Lead excluído", { id });
    return Response.json({ ok: true });
  } catch (err) {
    log.error("Erro ao excluir lead", { id, error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
