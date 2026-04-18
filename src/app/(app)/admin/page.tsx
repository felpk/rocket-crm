import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Users, Target, Zap } from "lucide-react";
import GoogleAdsAssignment from "@/components/admin/GoogleAdsAssignment";

export default async function AdminPage() {
  await requireAdmin();

  const [clients, totalLeads, activeAutomations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "client" },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.count(),
    prisma.automation.count({ where: { active: true } }),
  ]);

  const stats = [
    { label: "Total de Clientes", value: clients.length, icon: Users, color: "text-accent" },
    { label: "Total de Leads", value: totalLeads, icon: Target, color: "text-success" },
    { label: "Automações Ativas", value: activeAutomations, icon: Zap, color: "text-warning" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Painel Administrativo</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/60">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Google Ads Account Assignment */}
      <div className="mb-8">
        <GoogleAdsAssignment
          clients={clients.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company,
          }))}
        />
      </div>

      {/* Client list */}
      <h2 className="text-lg font-semibold mb-4">Clientes Cadastrados</h2>
      <div className="bg-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-4">Nome</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Empresa</th>
                <th className="text-center p-4">Leads</th>
                <th className="text-left p-4">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="p-4 font-medium">{client.name}</td>
                  <td className="p-4 text-white/60">{client.email}</td>
                  <td className="p-4 text-white/60">
                    {client.company || "—"}
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-full text-xs">
                      {client._count.leads}
                    </span>
                  </td>
                  <td className="p-4 text-white/40">
                    {formatDate(client.createdAt)}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-white/40"
                  >
                    Nenhum cliente cadastrado ainda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
