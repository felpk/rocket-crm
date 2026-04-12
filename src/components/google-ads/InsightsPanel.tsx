"use client";

import { formatCurrency } from "@/lib/utils";

interface DailyPoint {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

interface Budget {
  campaignName: string;
  status: string;
  dailyBudget: number;
  spend: number;
  utilization: number;
}

interface ChangeEvent {
  date: string;
  resourceType: string;
  operation: string;
  userEmail: string;
}

interface Recommendation {
  type: string;
  campaign: string;
  impactImpressions: number;
  impactClicks: number;
  impactCost: number;
  potentialImpressions: number;
  potentialClicks: number;
  potentialCost: number;
}

interface Props {
  daily: DailyPoint[];
  budgets: Budget[];
  changeHistory: ChangeEvent[];
  recommendations: Recommendation[];
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

const resourceTypeLabels: Record<string, string> = {
  CAMPAIGN: "Campanha",
  AD: "Anuncio",
  AD_GROUP: "Grupo",
  CAMPAIGN_BUDGET: "Orcamento",
  AD_GROUP_CRITERION: "Palavra-chave",
  AD_GROUP_BID_MODIFIER: "Ajuste de Lance",
};

const operationLabels: Record<string, string> = {
  CREATE: "Criacao",
  UPDATE: "Alteracao",
  REMOVE: "Remocao",
};

const recommendationTypeLabels: Record<string, string> = {
  KEYWORD: "Palavra-chave",
  TARGET_CPA_OPT_IN: "CPA Automatico",
  TEXT_AD: "Anuncio de Texto",
  SITELINK_EXTENSION: "Sitelink",
};

function utilizationColor(util: number): string {
  if (util < 0.5) return "bg-yellow-400";
  if (util <= 0.85) return "bg-green-400";
  return "bg-red-400";
}

function statusBadge(status: string) {
  if (status === "ENABLED") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-green-400/10 text-green-400">
        Ativo
      </span>
    );
  }
  if (status === "PAUSED") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-400/10 text-yellow-400">
        Pausado
      </span>
    );
  }
  return <span className="text-xs text-white/40">{status}</span>;
}

export default function InsightsPanel({
  daily,
  budgets,
  changeHistory,
  recommendations,
}: Props) {
  return (
    <div>
      {/* Performance Diaria */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Performance Diaria</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-right p-3 font-medium">Impressoes</th>
                <th className="text-right p-3 font-medium">Cliques</th>
                <th className="text-right p-3 font-medium">Custo</th>
                <th className="text-right p-3 font-medium">Conversoes</th>
                <th className="text-right p-3 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">{formatDateShort(d.date)}</td>
                  <td className="p-3 text-right">
                    {d.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {d.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(d.spend)}
                  </td>
                  <td className="p-3 text-right">{d.conversions}</td>
                  <td className="p-3 text-right">
                    {formatCurrency(d.conversionsValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orcamentos */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Orcamentos</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Campanha</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">
                  Orcamento Diario
                </th>
                <th className="text-right p-3 font-medium">Gasto</th>
                <th className="text-left p-3 font-medium">Utilizacao</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">{b.campaignName}</td>
                  <td className="p-3">{statusBadge(b.status)}</td>
                  <td className="p-3 text-right">
                    {formatCurrency(b.dailyBudget)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(b.spend)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-white/10 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${utilizationColor(b.utilization)}`}
                          style={{
                            width: `${Math.min(b.utilization * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/60">
                        {(b.utilization * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historico de Alteracoes */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          Historico de Alteracoes
        </h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Data/Hora</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Operacao</th>
                <th className="text-left p-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {changeHistory.map((ch, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">{formatDateTime(ch.date)}</td>
                  <td className="p-3">
                    {resourceTypeLabels[ch.resourceType] ?? ch.resourceType}
                  </td>
                  <td className="p-3">
                    {operationLabels[ch.operation] ?? ch.operation}
                  </td>
                  <td className="p-3 text-white/60">{ch.userEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recomendacoes do Google */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          Recomendacoes do Google
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recommendations.map((rec, i) => {
            const typeLabel =
              recommendationTypeLabels[rec.type] ?? rec.type;
            return (
              <div
                key={i}
                className="bg-card rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{typeLabel}</span>
                  <span className="text-xs text-white/40">
                    {rec.campaign}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-white/60">
                  <div>
                    <p className="text-white/40">Impressoes atuais</p>
                    <p className="text-white">
                      {rec.impactImpressions.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40">Potencial</p>
                    <p className="text-green-400">
                      +
                      {(
                        rec.potentialImpressions - rec.impactImpressions
                      ).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40">Cliques potenciais</p>
                    <p className="text-green-400">
                      +
                      {(
                        rec.potentialClicks - rec.impactClicks
                      ).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
