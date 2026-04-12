// --- Trigger Types ---

export type TriggerType = "new_lead" | "stage_change" | "keyword" | "followup";

export type KeywordTriggerConfig = {
  keywords: string[];
  matchMode: "any" | "all";
};

export type StageChangeTriggerConfig = {
  fromStage?: string;
  toStage: string;
};

export type NewLeadTriggerConfig = {
  origin?: string;
};

export type FollowupTriggerConfig = {
  delayHours: number;
  afterEvent: "created" | "last_message";
  onlyIfNoReply: boolean;
  stage?: string;
};

export type TriggerConfig =
  | KeywordTriggerConfig
  | StageChangeTriggerConfig
  | NewLeadTriggerConfig
  | FollowupTriggerConfig;

// --- Action Types ---

export type ActionType = "send_message" | "move_stage" | "create_lead" | "notify";

export type SendMessageActionConfig = {
  template: string;
};

export type MoveStageActionConfig = {
  stage: string;
};

export type CreateLeadActionConfig = {
  stage: string;
  origin: string;
};

export type NotifyActionConfig = {
  message: string;
};

export type AutomationAction = {
  type: ActionType;
  config:
    | SendMessageActionConfig
    | MoveStageActionConfig
    | CreateLeadActionConfig
    | NotifyActionConfig;
};

// --- Full Automation ---

export type AutomationFull = {
  id: string;
  name: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  actions: AutomationAction[];
  active: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

// --- Execution Context ---

export type LeadContext = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
};

export type ExecutionContext = {
  lead?: LeadContext;
  incomingMessage?: string;
  senderPhone?: string;
  userId: string;
};

// --- Trigger/Action labels for UI ---

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  keyword: "Palavra-chave",
  new_lead: "Novo Lead",
  stage_change: "Mudança de Etapa",
  followup: "Follow-up",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  send_message: "Enviar Mensagem",
  move_stage: "Mover Etapa",
  create_lead: "Criar Lead",
  notify: "Notificar",
};

export const TRIGGER_COLORS: Record<TriggerType, string> = {
  keyword: "bg-purple-500/20 text-purple-400",
  new_lead: "bg-blue-500/20 text-blue-400",
  stage_change: "bg-yellow-500/20 text-yellow-400",
  followup: "bg-orange-500/20 text-orange-400",
};

export const ACTION_COLORS: Record<ActionType, string> = {
  send_message: "bg-green-500/20 text-green-400",
  move_stage: "bg-cyan-500/20 text-cyan-400",
  create_lead: "bg-blue-500/20 text-accent",
  notify: "bg-yellow-500/20 text-yellow-400",
};
