"use client";

import { ChevronDown } from "lucide-react";

const OPTIONS = [
  { value: "ALL_TIME", label: "Todo periodo" },
  { value: "LAST_7_DAYS", label: "Ultimos 7 dias" },
  { value: "LAST_30_DAYS", label: "Ultimos 30 dias" },
  { value: "THIS_MONTH", label: "Este mes" },
  { value: "LAST_MONTH", label: "Mes passado" },
  { value: "LAST_90_DAYS", label: "Ultimos 90 dias" },
] as const;

interface Props {
  value: string;
  onChange: (range: string) => void;
}

export default function DateRangeSelector({ value, onChange }: Props) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/10 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:border-accent outline-none appearance-none pr-8"
      >
        {OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-card text-white"
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
    </div>
  );
}
