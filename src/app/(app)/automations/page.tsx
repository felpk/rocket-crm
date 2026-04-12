"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  MessageSquare,
  ArrowRight,
  Clock,
  X,
  UserPlus,
  Bell,
  ChevronRight,
} from "lucide-react";
import {
  TRIGGER_LABELS,
  TRIGGER_COLORS,
  ACTION_LABELS,
  ACTION_COLORS,
  type TriggerType,
  type ActionType,
  type AutomationAction,
  type TriggerConfig,
} from "@/lib/automations/types";
import { STAGES } from "@/lib/utils";

// ---------- Types ----------

interface AutomationWithCount {
  id: string;
  name: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  actions: AutomationAction[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { logs: number };
}

interface LogEntry {
  id: string;
  status: "success" | "error" | "skipped";
  detail: string | null;
  executedAt: string;
  lead: { id: string; name: string; phone: string | null } | null;
}

const ORIGINS = [
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "indicacao", label: "Indicação" },
  { value: "organico", label: "Orgânico" },
  { value: "outro", label: "Outro" },
];

// ---------- Helper ----------

function triggerSummary(t: TriggerType, c: TriggerConfig): string {
  switch (t) {
    case "keyword": {
      const kc = c as { keywords: string[]; matchMode: string };
      return `Palavras: ${(kc.keywords ?? []).join(", ")} (${kc.matchMode === "all" ? "todas" : "qualquer"})`;
    }
    case "new_lead": {
      const nc = c as { origin?: string };
      if (nc.origin) {
        const o = ORIGINS.find((x) => x.value === nc.origin);
        return `Novo lead de: ${o?.label ?? nc.origin}`;
      }
      return "Qualquer novo lead";
    }
    case "stage_change": {
      const sc = c as { fromStage?: string; toStage: string };
      const from = sc.fromStage
        ? STAGES.find((s) => s.id === sc.fromStage)?.label ?? sc.fromStage
        : "Qualquer";
      const to = STAGES.find((s) => s.id === sc.toStage)?.label ?? sc.toStage;
      return `Quando move de ${from} para ${to}`;
    }
    case "followup": {
      const fc = c as { delayHours: number; afterEvent: string; onlyIfNoReply: boolean; stage?: string };
      const unit = fc.delayHours >= 24 && fc.delayHours % 24 === 0
        ? `${fc.delayHours / 24} dia(s)`
        : `${fc.delayHours}h`;
      const after = fc.afterEvent === "created" ? "criação" : "última mensagem";
      let text = `${unit} após ${after}`;
      if (fc.onlyIfNoReply) text += " (sem resposta)";
      if (fc.stage) {
        const sl = STAGES.find((s) => s.id === fc.stage)?.label ?? fc.stage;
        text += ` — etapa: ${sl}`;
      }
      return text;
    }
    default:
      return "";
  }
}

// ---------- Component ----------

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [logsAutomationId, setLogsAutomationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTriggerType, setFormTriggerType] = useState<TriggerType>("keyword");
  // keyword
  const [formKeywords, setFormKeywords] = useState("");
  const [formMatchMode, setFormMatchMode] = useState<"any" | "all">("any");
  // new_lead
  const [formOrigin, setFormOrigin] = useState("");
  // stage_change
  const [formFromStage, setFormFromStage] = useState("");
  const [formToStage, setFormToStage] = useState("");
  // followup
  const [formDelay, setFormDelay] = useState(1);
  const [formDelayUnit, setFormDelayUnit] = useState<"hours" | "days">("hours");
  const [formAfterEvent, setFormAfterEvent] = useState<"created" | "last_message">("created");
  const [formOnlyIfNoReply, setFormOnlyIfNoReply] = useState(false);
  const [formFollowupStage, setFormFollowupStage] = useState("");
  // actions
  const [formActions, setFormActions] = useState<
    { type: ActionType; config: Record<string, string | boolean> }[]
  >([{ type: "send_message", config: { template: "" } }]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- Fetch ----------

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/automations");
      if (res.ok) {
        const data = await res.json();
        setAutomations(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    // Fire tick on mount
    fetch("/api/automations/tick", { method: "POST" }).catch(() => {});
    // Tick every 15 min
    tickRef.current = setInterval(() => {
      fetch("/api/automations/tick", { method: "POST" }).catch(() => {});
    }, 15 * 60 * 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchAutomations]);

  // ---------- Toggle active ----------

  async function toggleActive(a: AutomationWithCount) {
    try {
      const res = await fetch(`/api/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !a.active }),
      });
      if (res.ok) {
        setAutomations((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))
        );
      }
    } catch {
      // ignore
    }
  }

  // ---------- Delete ----------

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((x) => x.id !== id));
      setDeleteConfirmId(null);
    } catch {
      // ignore
    }
  }

  // ---------- Logs ----------

  async function openLogs(id: string) {
    setLogsAutomationId(id);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/automations/${id}/logs`);
      if (res.ok) setLogs(await res.json());
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }

  // ---------- Modal open / close ----------

  function resetForm() {
    setFormName("");
    setFormTriggerType("keyword");
    setFormKeywords("");
    setFormMatchMode("any");
    setFormOrigin("");
    setFormFromStage("");
    setFormToStage("");
    setFormDelay(1);
    setFormDelayUnit("hours");
    setFormAfterEvent("created");
    setFormOnlyIfNoReply(false);
    setFormFollowupStage("");
    setFormActions([{ type: "send_message", config: { template: "" } }]);
    setError(null);
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(a: AutomationWithCount) {
    setEditingId(a.id);
    setFormName(a.name);
    setFormTriggerType(a.triggerType);

    const tc = a.triggerConfig as Record<string, unknown>;
    if (a.triggerType === "keyword") {
      setFormKeywords(((tc.keywords as string[]) ?? []).join(", "));
      setFormMatchMode((tc.matchMode as "any" | "all") ?? "any");
    }
    if (a.triggerType === "new_lead") {
      setFormOrigin((tc.origin as string) ?? "");
    }
    if (a.triggerType === "stage_change") {
      setFormFromStage((tc.fromStage as string) ?? "");
      setFormToStage((tc.toStage as string) ?? "");
    }
    if (a.triggerType === "followup") {
      const dh = (tc.delayHours as number) ?? 1;
      if (dh >= 24 && dh % 24 === 0) {
        setFormDelay(dh / 24);
        setFormDelayUnit("days");
      } else {
        setFormDelay(dh);
        setFormDelayUnit("hours");
      }
      setFormAfterEvent((tc.afterEvent as "created" | "last_message") ?? "created");
      setFormOnlyIfNoReply((tc.onlyIfNoReply as boolean) ?? false);
      setFormFollowupStage((tc.stage as string) ?? "");
    }

    setFormActions(
      a.actions.map((act) => ({
        type: act.type,
        config: { ...(act.config as Record<string, string | boolean>) },
      }))
    );
    setError(null);
    setModalOpen(true);
  }

  // ---------- Build payload ----------

  function buildTriggerConfig(): TriggerConfig {
    switch (formTriggerType) {
      case "keyword":
        return {
          keywords: formKeywords.split(",").map((k) => k.trim()).filter(Boolean),
          matchMode: formMatchMode,
        };
      case "new_lead":
        return formOrigin ? { origin: formOrigin } : {};
      case "stage_change":
        return {
          ...(formFromStage ? { fromStage: formFromStage } : {}),
          toStage: formToStage,
        } as TriggerConfig;
      case "followup":
        return {
          delayHours: formDelayUnit === "days" ? formDelay * 24 : formDelay,
          afterEvent: formAfterEvent,
          onlyIfNoReply: formOnlyIfNoReply,
          ...(formFollowupStage ? { stage: formFollowupStage } : {}),
        } as TriggerConfig;
      default:
        return {} as TriggerConfig;
    }
  }

  // ---------- Save ----------

  async function handleSave() {
    setError(null);
    setSaving(true);
    const body = {
      name: formName,
      triggerType: formTriggerType,
      triggerConfig: buildTriggerConfig(),
      actions: formActions.map((a) => ({ type: a.type, config: a.config })),
    };

    try {
      const url = editingId ? `/api/automations/${editingId}` : "/api/automations";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      fetchAutomations();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Action helpers ----------

  function addAction() {
    setFormActions((prev) => [...prev, { type: "send_message", config: { template: "" } }]);
  }

  function removeAction(idx: number) {
    setFormActions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateActionType(idx: number, type: ActionType) {
    setFormActions((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const defaults: Record<ActionType, Record<string, string | boolean>> = {
          send_message: { template: "" },
          move_stage: { stage: "" },
          create_lead: { stage: "lead", origin: "outro" },
          notify: { message: "" },
        };
        return { type, config: defaults[type] };
      })
    );
  }

  function updateActionConfig(idx: number, key: string, value: string | boolean) {
    setFormActions((prev) =>
      prev.map((a, i) => (i !== idx ? a : { ...a, config: { ...a.config, [key]: value } }))
    );
  }

  // ---------- Render ----------

  const actionIcon = (type: ActionType) => {
    switch (type) {
      case "send_message":
        return <MessageSquare className="w-3 h-3" />;
      case "move_stage":
        return <ArrowRight className="w-3 h-3" />;
      case "create_lead":
        return <UserPlus className="w-3 h-3" />;
      case "notify":
        return <Bell className="w-3 h-3" />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Automações</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Automação
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-card rounded-xl p-12 text-center">
          <p className="text-white/50 text-sm">Carregando automações...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && automations.length === 0 && (
        <div className="bg-card rounded-xl p-12 text-center">
          <Zap className="w-12 h-12 text-warning mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Nenhuma automação criada</h2>
          <p className="text-white/50 text-sm max-w-md mx-auto mb-6">
            Crie sua primeira automação para automatizar tarefas como enviar mensagens
            de follow-up, mover leads no funil ou notificar sua equipe.
          </p>
          <div className="text-white/40 text-xs space-y-1 max-w-sm mx-auto text-left">
            <p>Exemplos de uso:</p>
            <p>• Enviar mensagem de boas-vindas quando um novo lead entra</p>
            <p>• Follow-up automático após 24h sem resposta</p>
            <p>• Notificar equipe quando lead avança para &quot;Proposta&quot;</p>
            <p>• Mover lead para etapa seguinte por palavra-chave</p>
          </div>
          <button
            onClick={openCreate}
            className="mt-6 flex items-center gap-2 bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            Criar Primeira Automação
          </button>
        </div>
      )}

      {/* Automation cards */}
      {!loading && automations.length > 0 && (
        <div className="space-y-4">
          {automations.map((a) => (
            <div key={a.id} className="bg-card rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h3 className="font-bold text-base truncate">{a.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_COLORS[a.triggerType]}`}
                    >
                      {TRIGGER_LABELS[a.triggerType]}
                    </span>
                  </div>
                  {/* Trigger summary */}
                  <p className="text-white/50 text-xs mb-2">
                    {triggerSummary(a.triggerType, a.triggerConfig)}
                  </p>
                  {/* Action badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {a.actions.map((act, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[act.type]}`}
                      >
                        {actionIcon(act.type)}
                        {ACTION_LABELS[act.type]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Logs button */}
                  <button
                    onClick={() => openLogs(a.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Logs
                    {a._count.logs > 0 && (
                      <span className="ml-1 bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                        {a._count.logs}
                      </span>
                    )}
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleActive(a)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title={a.active ? "Desativar" : "Ativar"}
                  >
                    {a.active ? (
                      <ToggleRight className="w-6 h-6 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-white/30" />
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4 text-white/60" />
                  </button>

                  {/* Delete */}
                  {deleteConfirmId === a.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(a.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-red-400/60" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== LOGS PANEL ========== */}
      {logsAutomationId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setLogsAutomationId(null)}
          />
          <div className="relative w-full max-w-lg bg-card h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Logs de Execução</h2>
              <button
                onClick={() => setLogsAutomationId(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {logsLoading ? (
              <p className="text-white/50 text-sm">Carregando logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-white/50 text-sm">Nenhum log encontrado.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="bg-background rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          l.status === "success"
                            ? "bg-green-400"
                            : l.status === "error"
                            ? "bg-red-400"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="font-medium truncate">
                        {l.lead?.name ?? "—"}
                      </span>
                      <span className="text-white/40 text-xs ml-auto shrink-0">
                        {new Date(l.executedAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {l.detail && (
                      <p className="text-white/50 text-xs pl-4">{l.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== CREATE / EDIT MODAL ========== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">
                {editingId ? "Editar Automação" : "Nova Automação"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/20 text-red-400">
                {error}
              </div>
            )}

            {/* Step 1: Basics */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                <span className="bg-accent/20 text-accent w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                Informações Básicas
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Nome</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Follow-up 24h sem resposta"
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Tipo de Gatilho</label>
                  <select
                    value={formTriggerType}
                    onChange={(e) => setFormTriggerType(e.target.value as TriggerType)}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  >
                    {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                      <option key={t} value={t}>
                        {TRIGGER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Trigger Config */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                <span className="bg-accent/20 text-accent w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                Configuração do Gatilho
              </h3>

              {formTriggerType === "keyword" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">
                      Palavras-chave (separadas por vírgula)
                    </label>
                    <textarea
                      value={formKeywords}
                      onChange={(e) => setFormKeywords(e.target.value)}
                      placeholder="orçamento, preço, valor, proposta"
                      rows={2}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Modo de correspondência</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={formMatchMode === "any"}
                          onChange={() => setFormMatchMode("any")}
                          className="accent-accent"
                        />
                        Qualquer palavra
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={formMatchMode === "all"}
                          onChange={() => setFormMatchMode("all")}
                          className="accent-accent"
                        />
                        Todas as palavras
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {formTriggerType === "new_lead" && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Origem (opcional — vazio = qualquer)
                  </label>
                  <select
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="">Qualquer origem</option>
                    {ORIGINS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formTriggerType === "stage_change" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">De (opcional)</label>
                    <select
                      value={formFromStage}
                      onChange={(e) => setFormFromStage(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="">Qualquer etapa</option>
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Para (obrigatório)</label>
                    <select
                      value={formToStage}
                      onChange={(e) => setFormToStage(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="">Selecione...</option>
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {formTriggerType === "followup" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Tempo de espera</label>
                      <input
                        type="number"
                        min={1}
                        value={formDelay}
                        onChange={(e) => setFormDelay(Number(e.target.value))}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Unidade</label>
                      <select
                        value={formDelayUnit}
                        onChange={(e) => setFormDelayUnit(e.target.value as "hours" | "days")}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                      >
                        <option value="hours">Horas</option>
                        <option value="days">Dias</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Contar a partir de</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={formAfterEvent === "created"}
                          onChange={() => setFormAfterEvent("created")}
                          className="accent-accent"
                        />
                        Criação do lead
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          checked={formAfterEvent === "last_message"}
                          onChange={() => setFormAfterEvent("last_message")}
                          className="accent-accent"
                        />
                        Última mensagem
                      </label>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOnlyIfNoReply}
                      onChange={(e) => setFormOnlyIfNoReply(e.target.checked)}
                      className="accent-accent"
                    />
                    Apenas se o lead não respondeu
                  </label>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">
                      Filtrar por etapa (opcional)
                    </label>
                    <select
                      value={formFollowupStage}
                      onChange={(e) => setFormFollowupStage(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="">Qualquer etapa</option>
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Actions */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                <span className="bg-accent/20 text-accent w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                Ações
              </h3>
              <div className="space-y-3">
                {formActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="bg-background rounded-lg p-4 border border-white/5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-white/40">Ação {idx + 1}</span>
                      <select
                        value={action.type}
                        onChange={(e) => updateActionType(idx, e.target.value as ActionType)}
                        className="flex-1 bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                      >
                        {(Object.keys(ACTION_LABELS) as ActionType[]).map((at) => (
                          <option key={at} value={at}>
                            {ACTION_LABELS[at]}
                          </option>
                        ))}
                      </select>
                      {formActions.length > 1 && (
                        <button
                          onClick={() => removeAction(idx)}
                          className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remover ação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {action.type === "send_message" && (
                      <div>
                        <textarea
                          value={(action.config.template as string) ?? ""}
                          onChange={(e) => updateActionConfig(idx, "template", e.target.value)}
                          placeholder="Olá {nome}! Tudo bem? Vi que você se interessou..."
                          rows={3}
                          className="w-full bg-card border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none"
                        />
                        <p className="text-xs text-white/40 mt-1">
                          Variáveis: {"{nome}"}, {"{empresa}"}, {"{telefone}"}, {"{email}"}, {"{etapa}"}
                        </p>
                      </div>
                    )}

                    {action.type === "move_stage" && (
                      <select
                        value={(action.config.stage as string) ?? ""}
                        onChange={(e) => updateActionConfig(idx, "stage", e.target.value)}
                        className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                      >
                        <option value="">Selecione a etapa...</option>
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {action.type === "create_lead" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Etapa inicial</label>
                          <select
                            value={(action.config.stage as string) ?? "lead"}
                            onChange={(e) => updateActionConfig(idx, "stage", e.target.value)}
                            className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Origem</label>
                          <select
                            value={(action.config.origin as string) ?? "outro"}
                            onChange={(e) => updateActionConfig(idx, "origin", e.target.value)}
                            className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                          >
                            {ORIGINS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {action.type === "notify" && (
                      <textarea
                        value={(action.config.message as string) ?? ""}
                        onChange={(e) => updateActionConfig(idx, "message", e.target.value)}
                        placeholder="Lead {nome} precisa de atenção!"
                        rows={2}
                        className="w-full bg-card border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addAction}
                className="mt-3 flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar ação
              </button>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Automação"}
                {!saving && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
