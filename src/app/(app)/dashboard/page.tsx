"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  MessageSquare,
  BarChart3,
  Zap,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, STAGES } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardLead {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  value: number;
  createdAt: string;
}

interface StageCount {
  stage: string;
  count: number;
  value: number;
}

interface OriginCount {
  origin: string;
  count: number;
  percentage: number;
}

interface DashboardData {
  totalLeads: number;
  newToday: number;
  conversions: number;
  totalValue: number;
  conversionRate: number;
  stageCounts: StageCount[];
  originCounts: OriginCount[];
  recentLeads: DashboardLead[];
  whatsappConnected: boolean;
  googleAdsConnected: boolean;
  googleAdsAccount: string | null;
  activeAutomations: number;
  messagesToday: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500",
  qualification: "bg-yellow-500",
  meeting: "bg-purple-500",
  proposal: "bg-orange-500",
  negotiation: "bg-cyan-500",
  closed: "bg-green-500",
};

const STAGE_TEXT_COLORS: Record<string, string> = {
  lead: "text-blue-400",
  qualification: "text-yellow-400",
  meeting: "text-purple-400",
  proposal: "text-orange-400",
  negotiation: "text-cyan-400",
  closed: "text-green-400",
};

const STAGE_BG_COLORS: Record<string, string> = {
  lead: "bg-blue-500/15",
  qualification: "bg-yellow-500/15",
  meeting: "bg-purple-500/15",
  proposal: "bg-orange-500/15",
  negotiation: "bg-cyan-500/15",
  closed: "bg-green-500/15",
};

const ORIGIN_COLORS: Record<string, string> = {
  whatsapp: "bg-[#3b6fd4]",
  manual: "bg-[#22C55E]",
  google_ads: "bg-[#EAB308]",
  other: "bg-purple-500",
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  }
  return formatCurrency(value);
}

function stageLabel(stageId: string): string {
  return STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#1a1f2e] rounded-xl ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-6 min-h-screen bg-[#121721]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-40" />
      </div>

      {/* KPI row */}
      <div className="flex gap-3 mb-5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="min-w-[140px] h-[88px] flex-1" />
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Skeleton className="h-[220px]" />
        <Skeleton className="h-[220px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut chart (desktop only)                                         */
/* ------------------------------------------------------------------ */

function DonutChart({ origins }: { origins: OriginCount[] }) {
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colorMap: Record<string, string> = {
    whatsapp: "#3b6fd4",
    manual: "#22C55E",
    google_ads: "#EAB308",
    other: "#a855f7",
  };

  let offset = 0;
  const segments = origins.map((o) => {
    const length = (o.percentage / 100) * circumference;
    const segment = {
      key: o.origin,
      color: colorMap[o.origin] ?? "#6b7280",
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offset,
    };
    offset += length;
    return segment;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg) => (
        <circle
          key={seg.key}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={seg.dashArray}
          strokeDashoffset={seg.dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingSkeleton />;

  const maxFunnelCount = Math.max(
    ...data.stageCounts.map((s) => s.count),
    1,
  );

  const originLabels: Record<string, string> = {
    whatsapp: "WhatsApp",
    manual: "Manual",
    google_ads: "Google Ads",
    other: "Outro",
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <span className="text-xs text-white/50 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Hoje: {todayFormatted()}
        </span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="flex gap-3 mb-5 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none shrink-0">
        {[
          {
            icon: Target,
            label: "Leads",
            value: String(data.totalLeads),
            sub: `Total no funil`,
            color: "text-[#3b6fd4]",
          },
          {
            icon: Plus,
            label: "Novos",
            value: `+${data.newToday}`,
            sub: "hoje",
            color: "text-[#22C55E]",
            subColor: "text-[#22C55E]",
          },
          {
            icon: Users,
            label: "Conversões",
            value: String(data.conversions),
            sub: `${data.conversionRate.toFixed(1)}% do total`,
            color: "text-[#22C55E]",
          },
          {
            icon: DollarSign,
            label: "Valor",
            value: formatCompact(data.totalValue),
            sub: "no funil",
            color: "text-[#EAB308]",
          },
          {
            icon: TrendingUp,
            label: "Taxa",
            value: `${data.conversionRate.toFixed(1)}%`,
            sub: "conversão",
            color: "text-[#3b6fd4]",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-[#1a1f2e] rounded-xl p-3 min-w-[140px] flex-1 snap-start hover:bg-[#222838] transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[11px] text-white/50 uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p
              className={`text-[11px] mt-0.5 ${card.subColor ?? "text-white/40"}`}
            >
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main grid (fills remaining space) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* ── Funil de Vendas ── */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 hover:bg-[#222838] transition-colors flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-[#3b6fd4]" />
            <h2 className="text-sm font-semibold text-white">
              Funil de Vendas
            </h2>
          </div>
          <div className="space-y-2 flex-1 flex flex-col justify-center">
            {data.stageCounts.map((sc) => {
              const pct = (sc.count / maxFunnelCount) * 100;
              return (
                <div key={sc.stage} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${STAGE_COLORS[sc.stage] ?? "bg-gray-500"}`}
                  />
                  <span className="text-xs text-white/70 w-24 truncate">
                    {stageLabel(sc.stage)}
                  </span>
                  <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md ${STAGE_COLORS[sc.stage] ?? "bg-gray-500"} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-white w-6 text-right">
                    {sc.count}
                  </span>
                  <span className="text-[10px] text-white/40 w-16 text-right hidden lg:block">
                    {formatCurrency(sc.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Leads por Origem ── */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 hover:bg-[#222838] transition-colors flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#3b6fd4]" />
            <h2 className="text-sm font-semibold text-white">
              Leads por Origem
            </h2>
          </div>

          {/* Desktop: donut + legend */}
          <div className="hidden md:flex items-center justify-center gap-6 flex-1">
            <DonutChart origins={data.originCounts} />
            <div className="space-y-2.5">
              {data.originCounts.map((o) => (
                <div key={o.origin} className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${ORIGIN_COLORS[o.origin] ?? "bg-gray-500"}`}
                  />
                  <span className="text-xs text-white/70 w-20">
                    {originLabels[o.origin] ?? o.origin}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {o.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: simple list */}
          <div className="md:hidden space-y-2 flex-1 flex flex-col justify-center">
            {data.originCounts.map((o) => (
              <div
                key={o.origin}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${ORIGIN_COLORS[o.origin] ?? "bg-gray-500"}`}
                  />
                  <span className="text-xs text-white/70">
                    {originLabels[o.origin] ?? o.origin}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">{o.count}</span>
                  <span className="text-xs font-semibold text-white">
                    {o.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Leads Recentes ── */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 hover:bg-[#222838] transition-colors flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3b6fd4]" />
              <h2 className="text-sm font-semibold text-white">
                Leads Recentes
              </h2>
            </div>
            <Link
              href="/funnel"
              className="text-[11px] text-[#3b6fd4] hover:text-[#5a8be6] flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1 flex-1 flex flex-col justify-center">
            {data.recentLeads.length === 0 && (
              <p className="text-xs text-white/40 text-center py-4">
                Nenhum lead ainda
              </p>
            )}
            {data.recentLeads.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href="/funnel"
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-white block truncate">
                    {lead.name}
                  </span>
                  {lead.company && (
                    <span className="text-[10px] text-white/40 block truncate">
                      {lead.company}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STAGE_BG_COLORS[lead.stage] ?? "bg-gray-500/15"} ${STAGE_TEXT_COLORS[lead.stage] ?? "text-gray-400"}`}
                >
                  {stageLabel(lead.stage)}
                </span>
                <span className="text-xs font-medium text-white/70 shrink-0 w-16 text-right">
                  {formatCurrency(lead.value)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Status ── */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 hover:bg-[#222838] transition-colors flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#3b6fd4]" />
            <h2 className="text-sm font-semibold text-white">Status</h2>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* WhatsApp */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${data.whatsappConnected ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
              />
              <MessageSquare className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs text-white/70">WhatsApp</span>
              <span
                className={`text-[11px] ml-auto font-medium ${data.whatsappConnected ? "text-[#22C55E]" : "text-[#EF4444]"}`}
              >
                {data.whatsappConnected ? "Conectado" : "Desconectado"}
              </span>
            </div>

            {/* Google Ads */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${data.googleAdsConnected ? "bg-[#22C55E]" : "bg-white/20"}`}
              />
              <BarChart3 className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs text-white/70">Google Ads</span>
              <span
                className={`text-[11px] ml-auto font-medium ${data.googleAdsConnected ? "text-[#22C55E]" : "text-white/40"}`}
              >
                {data.googleAdsConnected
                  ? data.googleAdsAccount ?? "Conectado"
                  : "Não conectado"}
              </span>
            </div>

            {/* Automations */}
            <div className="flex items-center gap-2.5">
              <Zap className="w-3.5 h-3.5 text-[#EAB308]" />
              <span className="text-xs text-white/70 ml-0.5">
                {data.activeAutomations} automações ativas
              </span>
            </div>

            {/* Messages today */}
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#3b6fd4]" />
              <span className="text-xs text-white/70 ml-0.5">
                {data.messagesToday} mensagens hoje
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
