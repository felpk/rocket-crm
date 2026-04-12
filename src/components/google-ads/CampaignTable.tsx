"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Level = "basico" | "detalhado" | "completo";

interface Campaign {
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number;
  searchImpressionShare: number;
}

interface AdGroup {
  campaignName: string;
  campaignId: string;
  name: string;
  id: string;
  status: string;
  cpcBid: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

interface Props {
  campaigns: Campaign[];
  adGroups: AdGroup[];
  level: Level;
}

function StatusBadge({ status }: { status: string }) {
  let className = "";
  let label = status;

  switch (status) {
    case "ENABLED":
      className = "bg-green-500/20 text-green-400";
      label = "Ativo";
      break;
    case "PAUSED":
      className = "bg-white/10 text-white/50";
      label = "Pausado";
      break;
    case "REMOVED":
      className = "bg-red-500/20 text-red-400";
      label = "Removido";
      break;
    default:
      className = "bg-white/10 text-white/50";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function CampaignTable({ campaigns, adGroups, level }: Props) {
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const showExtra = level === "detalhado" || level === "completo";

  const toggleExpand = (name: string) => {
    if (!showExtra) return;
    setExpandedCampaign((prev) => (prev === name ? null : name));
  };

  const groupsForCampaign = (campaignName: string) =>
    adGroups.filter((ag) => ag.campaignName === campaignName);

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/60">
              {showExtra && <th className="px-4 py-3 text-left w-8" />}
              <th className="px-4 py-3 text-left">Campanha</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Impressões</th>
              <th className="px-4 py-3 text-right">Cliques</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">CPC</th>
              <th className="px-4 py-3 text-right">Custo</th>
              {showExtra && (
                <>
                  <th className="px-4 py-3 text-right">Conversões</th>
                  <th className="px-4 py-3 text-right">Valor Conv.</th>
                  <th className="px-4 py-3 text-right">Imp. Share</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={showExtra ? 11 : 7}
                  className="px-4 py-12 text-center text-white/50"
                >
                  Nenhuma campanha encontrada
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => {
                const isExpanded = expandedCampaign === campaign.name;
                const groups = groupsForCampaign(campaign.name);

                return (
                  <Fragment key={campaign.name}>
                    <tr
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        showExtra ? "cursor-pointer" : ""
                      }`}
                      onClick={() => toggleExpand(campaign.name)}
                    >
                      {showExtra && (
                        <td className="px-4 py-3">
                          {groups.length > 0 &&
                            (isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-white/40" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-white/40" />
                            ))}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">{campaign.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {campaign.impressions.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {campaign.clicks.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(campaign.ctr * 100).toFixed(2) + "%"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(campaign.cpc)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(campaign.spend)}
                      </td>
                      {showExtra && (
                        <>
                          <td className="px-4 py-3 text-right">
                            {campaign.conversions.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(campaign.conversionsValue)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(campaign.searchImpressionShare * 100).toFixed(1) + "%"}
                          </td>
                        </>
                      )}
                    </tr>

                    {showExtra &&
                      isExpanded &&
                      groups.map((ag) => (
                        <tr
                          key={ag.id}
                          className="border-b border-white/5 bg-white/[0.02]"
                        >
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 pl-10 text-white/70">
                            {ag.name}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={ag.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {ag.impressions.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {ag.clicks.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {(ag.ctr * 100).toFixed(2) + "%"}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {formatCurrency(ag.cpc)}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {formatCurrency(ag.spend)}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {ag.conversions.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right text-white/70">
                            {formatCurrency(ag.conversionsValue)}
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
