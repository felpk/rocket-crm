import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STAGES, formatCurrency, formatDate } from "@/lib/utils";
import { Target, Users, DollarSign, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const session = (await getSession())!;
  const isAdmin = session.role === "admin";
  const where = isAdmin ? {} : { userId: session.id };

  const [totalLeads, leads, recentLeads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, select: { stage: true, value: true } }),
    prisma.lead.findMany({
      where,
      select: { id: true, name: true, stage: true, value: true, createdAt: true, company: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const closedLeads = leads.filter((l) => l.stage === "closed");
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
  const conversionRate = totalLeads > 0 ? ((closedLeads.length / totalLeads) * 100).toFixed(1) : "0";

  const stageData = STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    return { ...stage, count: stageLeads.length, value: stageLeads.reduce((sum, l) => sum + l.value, 0) };
  });

  const maxCount = Math.max(...stageData.map((s) => s.count), 1);

  const stageMap = Object.fromEntries(STAGES.map((s) => [s.id, s]));

  const topCards = [
    { label: "Total de Leads", value: totalLeads, icon: Target, color: "text-accent" },
    { label: "Conversões", value: closedLeads.length, icon: Users, color: "text-success" },
    { label: "Valor no Funil", value: formatCurrency(totalValue), icon: DollarSign, color: "text-warning" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isAdmin ? "Dashboard Geral" : "Dashboard"}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {topCards.map((card) => (
          <div key={card.label} className="bg-card border border-border/50 rounded-xl p-5 transition-all hover:bg-card-hover hover:border-border hover:shadow-lg hover:shadow-accent/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-fg">{card.label}</span>
              <div className="bg-muted rounded-lg p-2">
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4">Leads por Etapa</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Horizontal Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-fg mb-4">Distribuição por Etapa</h3>
          <div className="space-y-3">
            {stageData.map((stage) => (
              <div key={stage.id} className="flex items-center gap-3">
                <span className="text-sm w-28 shrink-0 truncate">{stage.label}</span>
                <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all`}
                    style={{ width: `${(stage.count / maxCount) * 100}%`, minWidth: stage.count > 0 ? "2rem" : "0" }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-muted-fg">
                    {stage.count}
                  </span>
                </div>
                <span className="text-xs text-muted-fg w-24 text-right shrink-0">{formatCurrency(stage.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-card border border-border/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-fg mb-4">Leads Recentes</h3>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-fg">Nenhum lead ainda.</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => {
                const stage = stageMap[lead.stage];
                return (
                  <div key={lead.id} className="flex items-start gap-3 group">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${stage?.color ?? "bg-gray-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-fg">
                        {lead.company && <span className="truncate">{lead.company}</span>}
                        <span>{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-fg shrink-0">{formatCurrency(lead.value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
