import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("automations");

const VALID_TRIGGER_TYPES = ["new_lead", "stage_change", "keyword", "followup"] as const;
const VALID_ACTION_TYPES = ["send_message", "move_stage", "create_lead", "notify"] as const;

export async function GET() {
  log.info("GET /api/automations");
  try {
    const session = await requireAuth();

    const automations = await prisma.automation.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { logs: true } } },
    });

    const parsed = automations.map((a) => ({
      ...a,
      triggerConfig: JSON.parse(a.triggerConfig),
      actions: JSON.parse(a.actions),
    }));

    log.info("Automações listadas", { count: parsed.length });
    return Response.json(parsed);
  } catch (err) {
    log.error("Erro ao listar automações", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  log.info("POST /api/automations");
  try {
    const session = await requireAuth();
    const data = await req.json();

    // Validate name
    if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
      log.warn("Nome inválido", { name: data.name });
      return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    // Validate triggerType
    if (!VALID_TRIGGER_TYPES.includes(data.triggerType)) {
      log.warn("Tipo de trigger inválido", { triggerType: data.triggerType });
      return Response.json(
        { error: `Tipo de trigger inválido. Válidos: ${VALID_TRIGGER_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate triggerConfig per type
    const triggerConfig = data.triggerConfig ?? {};
    if (data.triggerType === "keyword") {
      if (!Array.isArray(triggerConfig.keywords) || triggerConfig.keywords.length === 0) {
        return Response.json(
          { error: "triggerConfig.keywords deve ser um array não vazio" },
          { status: 400 }
        );
      }
    }
    if (data.triggerType === "stage_change") {
      if (!triggerConfig.toStage || typeof triggerConfig.toStage !== "string") {
        return Response.json(
          { error: "triggerConfig.toStage é obrigatório para stage_change" },
          { status: 400 }
        );
      }
    }
    if (data.triggerType === "followup") {
      if (typeof triggerConfig.delayHours !== "number" || triggerConfig.delayHours <= 0) {
        return Response.json(
          { error: "triggerConfig.delayHours deve ser um número positivo" },
          { status: 400 }
        );
      }
    }

    // Validate actions
    if (!Array.isArray(data.actions) || data.actions.length === 0) {
      return Response.json(
        { error: "actions deve ser um array não vazio" },
        { status: 400 }
      );
    }
    for (const action of data.actions) {
      if (!VALID_ACTION_TYPES.includes(action.type)) {
        return Response.json(
          { error: `Tipo de ação inválido: ${action.type}. Válidos: ${VALID_ACTION_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const automation = await prisma.automation.create({
      data: {
        name: data.name.trim(),
        triggerType: data.triggerType,
        triggerConfig: JSON.stringify(triggerConfig),
        actions: JSON.stringify(data.actions),
        userId: session.id,
      },
    });

    log.info("Automação criada", { id: automation.id, name: automation.name });
    return Response.json(
      {
        ...automation,
        triggerConfig: JSON.parse(automation.triggerConfig),
        actions: JSON.parse(automation.actions),
      },
      { status: 201 }
    );
  } catch (err) {
    log.error("Erro ao criar automação", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
