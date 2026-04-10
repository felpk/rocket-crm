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

    log.info("Automacoes listadas", { count: parsed.length });
    return Response.json(parsed);
  } catch (err) {
    log.error("Erro ao listar automacoes", { error: String(err) });
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
      log.warn("Nome invalido", { name: data.name });
      return Response.json({ error: "Nome e obrigatorio" }, { status: 400 });
    }

    // Validate triggerType
    if (!VALID_TRIGGER_TYPES.includes(data.triggerType)) {
      log.warn("Tipo de trigger invalido", { triggerType: data.triggerType });
      return Response.json(
        { error: `Tipo de trigger invalido. Validos: ${VALID_TRIGGER_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate triggerConfig per type
    const triggerConfig = data.triggerConfig ?? {};
    if (data.triggerType === "keyword") {
      if (!Array.isArray(triggerConfig.keywords) || triggerConfig.keywords.length === 0) {
        return Response.json(
          { error: "triggerConfig.keywords deve ser um array nao vazio" },
          { status: 400 }
        );
      }
    }
    if (data.triggerType === "stage_change") {
      if (!triggerConfig.toStage || typeof triggerConfig.toStage !== "string") {
        return Response.json(
          { error: "triggerConfig.toStage e obrigatorio para stage_change" },
          { status: 400 }
        );
      }
    }
    if (data.triggerType === "followup") {
      if (typeof triggerConfig.delayHours !== "number" || triggerConfig.delayHours <= 0) {
        return Response.json(
          { error: "triggerConfig.delayHours deve ser um numero positivo" },
          { status: 400 }
        );
      }
    }

    // Validate actions
    if (!Array.isArray(data.actions) || data.actions.length === 0) {
      return Response.json(
        { error: "actions deve ser um array nao vazio" },
        { status: 400 }
      );
    }
    for (const action of data.actions) {
      if (!VALID_ACTION_TYPES.includes(action.type)) {
        return Response.json(
          { error: `Tipo de acao invalido: ${action.type}. Validos: ${VALID_ACTION_TYPES.join(", ")}` },
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

    log.info("Automacao criada", { id: automation.id, name: automation.name });
    return Response.json(
      {
        ...automation,
        triggerConfig: JSON.parse(automation.triggerConfig),
        actions: JSON.parse(automation.actions),
      },
      { status: 201 }
    );
  } catch (err) {
    log.error("Erro ao criar automacao", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
