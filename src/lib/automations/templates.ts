import type { ExecutionContext } from "./types";

/**
 * Renderiza variáveis de template substituindo placeholders pelo contexto do lead.
 * Placeholders suportados (case-insensitive): {nome}, {empresa}, {telefone}, {email}, {etapa}
 */
export function renderTemplate(template: string, context: ExecutionContext): string {
  const lead = context.lead;

  const variables: Record<string, string> = {
    nome: lead?.name ?? "",
    empresa: lead?.company ?? "",
    telefone: lead?.phone ?? "",
    email: lead?.email ?? "",
    etapa: lead?.stage ?? "",
  };

  return template.replace(/\{(\w+)\}/gi, (match, key: string) => {
    const value = variables[key.toLowerCase()];
    return value !== undefined ? value : match;
  });
}
