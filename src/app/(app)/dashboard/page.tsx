import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STAGES, formatCurrency } from "@/lib/utils";
import { Target, Users, DollarSign, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const session = (await getSession())!;
  const isAdmin = session.role === "admin";

  const where = isAdmin ? {} : { userId: session.id };

  const [totalLeads, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, select: { stage: true, value: true } }),
  ]);

  const closedLeads = leads.filter((l) => l.stage === "closed");
  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
  const conversionRate =
    totalLeads > 0
      ? ((closedLeads.length / totalLeads) * 100).toFixed(1)
      : "0";

  const stageData = STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    return {
      ...stage,
      count: stageLeads.length,
      value: stageLeads.reduce((sum, l) => sum + l.value, 0),
    };
  });

  const topCards = [
    {
      label: "Total de Leads",
      value: totalLeads,
      icon: Target,
      color: "text-accent",
    },
    {
      label: "Conversões",
      value: closedLeads.length,
      icon: Users,
      color: "text-success",
    },
    {
      label: "Valor no Funil",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: "text-warning",
    },
    {
      label: "Taxa de Conversão",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-accent",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {isAdmin ? "Dashboard Geral" : "Dashboard"}
      </h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {topCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/60">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <h2 className="text-lg font-semibold mb-4">Leads por Etapa</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stageData.map((stage) => (
          <div key={stage.id} className="bg-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${stage.color}`} />
              <span className="font-medium">{stage.label}</span>
            </div>
            <p className="text-3xl font-bold">{stage.count}</p>
            <p className="text-sm text-white/50 mt-1">
              {formatCurrency(stage.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
