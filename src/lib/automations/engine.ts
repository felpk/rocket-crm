import { prisma } from "@/lib/db";
import { sendTextMessage } from "@/lib/evolution";
import { createLogger } from "@/lib/logger";
import { renderTemplate } from "./templates";
import type {
  AutomationAction,
  ExecutionContext,
  FollowupTriggerConfig,
  TriggerType,
} from "./types";

const log = createLogger("automation-engine");

// ---------------------------------------------------------------------------
// Log result
// ---------------------------------------------------------------------------

async function logResult(
  automationId: string,
  status: "success" | "error" | "skipped",
  details: string,
  leadId?: string,
) {
  await prisma.automationLog.create({
    data: {
      automationId,
      status,
      details,
      leadId: leadId ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Execute a single action
// ---------------------------------------------------------------------------

async function executeAction(
  action: AutomationAction,
  context: ExecutionContext,
  automation: { id: string; userId: string },
): Promise<void> {
  const leadId = context.lead?.id;

  switch (action.type) {
    // ----- send_message -----
    case "send_message": {
      if (!context.lead?.phone) {
        log.warn("send_message skipped — lead sem telefone", {
          automationId: automation.id,
          leadId,
        });
        await logResult(automation.id, "skipped", "Lead sem telefone", leadId);
        return;
      }

      const conn = await prisma.whatsappConnection.findUnique({
        where: { userId: automation.userId },
      });

      if (!conn || conn.status !== "connected") {
        log.warn("send_message skipped — WhatsApp não conectado", {
          automationId: automation.id,
        });
        await logResult(automation.id, "skipped", "WhatsApp não conectado", leadId);
        return;
      }

      const cfg = action.config as { template: string };
      const text = renderTemplate(cfg.template, context);

      await sendTextMessage(conn.instanceName, context.lead.phone, text);
      log.info("send_message executada", { automationId: automation.id, leadId });
      await logResult(automation.id, "success", `Mensagem enviada: ${text.slice(0, 80)}`, leadId);
      break;
    }

    // ----- move_stage -----
    case "move_stage": {
      if (!context.lead) {
        log.warn("move_stage skipped — sem lead no contexto", { automationId: automation.id });
        await logResult(automation.id, "skipped", "Sem lead no contexto");
        return;
      }

      const cfg = action.config as { stage: string };
      await prisma.lead.update({
        where: { id: context.lead.id },
        data: { stage: cfg.stage },
      });

      context.lead.stage = cfg.stage;
      log.info("move_stage executada", {
        automationId: automation.id,
        leadId,
        stage: cfg.stage,
      });
      await logResult(automation.id, "success", `Etapa alterada para ${cfg.stage}`, leadId);
      break;
    }

    // ----- create_lead -----
    case "create_lead": {
      const cfg = action.config as { stage: string; origin: string };
      const phone = context.senderPhone ?? context.lead?.phone;

      if (!phone) {
        log.warn("create_lead skipped — sem telefone", { automationId: automation.id });
        await logResult(automation.id, "skipped", "Sem telefone disponível");
        return;
      }

      const existing = await prisma.lead.findFirst({
        where: { phone, userId: automation.userId },
      });

      if (existing) {
        context.lead = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          company: existing.company,
          stage: existing.stage,
        };
        log.info("create_lead — lead já existe", { automationId: automation.id, leadId: existing.id });
        await logResult(automation.id, "skipped", `Lead já existe: ${existing.id}`, existing.id);
        return;
      }

      const newLead = await prisma.lead.create({
        data: {
          name: phone,
          phone,
          stage: cfg.stage,
          origin: cfg.origin,
          userId: automation.userId,
        },
      });

      context.lead = {
        id: newLead.id,
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        company: newLead.company,
        stage: newLead.stage,
      };
      log.info("create_lead executada", { automationId: automation.id, leadId: newLead.id });
      await logResult(automation.id, "success", `Lead criado: ${newLead.id}`, newLead.id);
      break;
    }

    // ----- notify -----
    case "notify": {
      const user = await prisma.user.findUnique({ where: { id: automation.userId } });

      if (!user?.phone) {
        log.warn("notify skipped — usuário sem telefone", { automationId: automation.id });
        await logResult(automation.id, "skipped", "Usuário sem telefone", leadId);
        return;
      }

      const conn = await prisma.whatsappConnection.findUnique({
        where: { userId: automation.userId },
      });

      if (!conn || conn.status !== "connected") {
        log.warn("notify skipped — WhatsApp não conectado", { automationId: automation.id });
        await logResult(automation.id, "skipped", "WhatsApp não conectado", leadId);
        return;
      }

      const cfg = action.config as { message: string };
      const text = renderTemplate(cfg.message, context);

      await sendTextMessage(conn.instanceName, user.phone, text);
      log.info("notify executada", { automationId: automation.id, leadId });
      await logResult(automation.id, "success", `Notificação enviada: ${text.slice(0, 80)}`, leadId);
      break;
    }

    default:
      log.error("Tipo de ação desconhecido", { type: (action as AutomationAction).type });
      await logResult(automation.id, "error", `Ação desconhecida: ${(action as AutomationAction).type}`, leadId);
  }
}

// ---------------------------------------------------------------------------
// Run automations for a given trigger
// ---------------------------------------------------------------------------

export async function runAutomations(
  triggerType: TriggerType,
  userId: string,
  context: ExecutionContext,
  matchFn?: (triggerConfig: unknown) => boolean,
): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { userId, triggerType, active: true },
  });

  log.info("Buscando automações", { triggerType, userId, found: automations.length });

  for (const auto of automations) {
    try {
      const triggerConfig: unknown = JSON.parse(auto.triggerConfig);
      const actions: AutomationAction[] = JSON.parse(auto.actions);

      if (matchFn && !matchFn(triggerConfig)) {
        log.debug("Automação não corresponde ao filtro", { automationId: auto.id });
        continue;
      }

      log.info("Executando automação", { automationId: auto.id, name: auto.name, actionsCount: actions.length });

      for (const action of actions) {
        try {
          await executeAction(action, context, { id: auto.id, userId: auto.userId });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.error("Erro ao executar ação", {
            automationId: auto.id,
            actionType: action.type,
            error: message,
          });
          await logResult(auto.id, "error", `Erro em ${action.type}: ${message}`, context.lead?.id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("Erro ao processar automação", { automationId: auto.id, error: message });
      await logResult(auto.id, "error", `Erro ao processar: ${message}`, context.lead?.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Follow-up scan
// ---------------------------------------------------------------------------

export async function runFollowupScan(userId: string): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { userId, triggerType: "followup", active: true },
  });

  log.info("Follow-up scan", { userId, automations: automations.length });

  for (const auto of automations) {
    try {
      const config = JSON.parse(auto.triggerConfig) as FollowupTriggerConfig;
      const actions: AutomationAction[] = JSON.parse(auto.actions);
      const thresholdDate = new Date(Date.now() - config.delayHours * 60 * 60 * 1000);

      // Build lead query
      const whereClause: Record<string, unknown> = { userId };

      if (config.stage) {
        whereClause.stage = config.stage;
      }

      if (config.afterEvent === "last_message") {
        whereClause.lastMessageAt = { not: null, lte: thresholdDate };
      } else {
        whereClause.createdAt = { lte: thresholdDate };
      }

      if (config.onlyIfNoReply) {
        whereClause.lastMessageAt = whereClause.lastMessageAt ?? null;
      }

      const leads = await prisma.lead.findMany({ where: whereClause });

      log.info("Follow-up leads encontrados", {
        automationId: auto.id,
        leadsCount: leads.length,
      });

      for (const lead of leads) {
        // Deduplication: check if we already ran this recently
        const recentLog = await prisma.automationLog.findFirst({
          where: {
            automationId: auto.id,
            leadId: lead.id,
            status: "success",
            executedAt: { gte: thresholdDate },
          },
        });

        if (recentLog) {
          log.debug("Follow-up já executado recentemente", {
            automationId: auto.id,
            leadId: lead.id,
          });
          continue;
        }

        const context: ExecutionContext = {
          userId,
          lead: {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            stage: lead.stage,
          },
        };

        for (const action of actions) {
          try {
            await executeAction(action, context, { id: auto.id, userId: auto.userId });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.error("Erro em follow-up action", {
              automationId: auto.id,
              leadId: lead.id,
              actionType: action.type,
              error: message,
            });
            await logResult(auto.id, "error", `Erro em ${action.type}: ${message}`, lead.id);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("Erro no follow-up scan", { automationId: auto.id, error: message });
    }
  }
}
