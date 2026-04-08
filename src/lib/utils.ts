import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STAGES = [
  { id: "lead", label: "Lead", color: "bg-blue-500" },
  { id: "qualification", label: "Qualificação", color: "bg-yellow-500" },
  { id: "meeting", label: "Reunião", color: "bg-purple-500" },
  { id: "proposal", label: "Proposta", color: "bg-orange-500" },
  { id: "negotiation", label: "Negociação", color: "bg-cyan-500" },
  { id: "closed", label: "Fechado", color: "bg-green-500" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
