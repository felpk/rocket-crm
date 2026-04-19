"use client";

import {
  Eye,
  MousePointer,
  Percent,
  DollarSign,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Summary {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number;
}

interface Props {
  summary: Summary | null;
}

interface CardDef {
  label: string;
  icon: React.ElementType;
  color: string;
  getValue: (s: Summary) => string;
}

const CARDS: CardDef[] = [
  {
    label: "Impressões",
    icon: Eye,
    color: "text-accent",
    getValue: (s) => s.impressions.toLocaleString("pt-BR"),
  },
  {
    label: "Cliques",
    icon: MousePointer,
    color: "text-success",
    getValue: (s) => s.clicks.toLocaleString("pt-BR"),
  },
  {
    label: "CTR",
    icon: Percent,
    color: "text-warning",
    getValue: (s) => (s.ctr * 100).toFixed(2) + "%",
  },
  {
    label: "Investimento",
    icon: DollarSign,
    color: "text-accent",
    getValue: (s) => formatCurrency(s.spend),
  },
  {
    label: "Conversões",
    icon: Target,
    color: "text-success",
    getValue: (s) => s.conversions.toLocaleString("pt-BR"),
  },
  {
    label: "Custo/Conversão",
    icon: TrendingDown,
    color: "text-warning",
    getValue: (s) => formatCurrency(s.costPerConversion),
  },
  {
    label: "Valor de Conversão",
    icon: TrendingUp,
    color: "text-accent",
    getValue: (s) => formatCurrency(s.conversionsValue),
  },
];

export default function KpiCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = summary ? card.getValue(summary) : "0";

        return (
          <div key={card.label} className="bg-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/60">{card.label}</span>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        );
      })}
    </div>
  );
}
