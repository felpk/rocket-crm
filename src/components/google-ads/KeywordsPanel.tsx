"use client";

import { formatCurrency } from "@/lib/utils";

interface Keyword {
  campaignName: string;
  adGroupName: string;
  text: string;
  matchType: string;
  qualityScore: number;
  bid: number;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
}

interface SearchTerm {
  searchTerm: string;
  campaignName: string;
  adGroupName: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}

interface Props {
  keywords: Keyword[];
  searchTerms: SearchTerm[];
}

const matchTypeLabels: Record<string, string> = {
  EXACT: "Exata",
  PHRASE: "Frase",
  BROAD: "Ampla",
};

const searchTermStatusLabels: Record<string, { label: string; color: string }> = {
  ADDED: { label: "Adicionado", color: "text-green-400" },
  EXCLUDED: { label: "Excluido", color: "text-red-400" },
  NONE: { label: "—", color: "text-white/40" },
};

function qualityScoreColor(score: number): string {
  if (score <= 4) return "text-red-400";
  if (score <= 6) return "text-yellow-400";
  return "text-green-400";
}

export default function KeywordsPanel({ keywords, searchTerms }: Props) {
  return (
    <div>
      {/* Palavras-chave */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Palavras-chave</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Palavra-chave</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Quality Score</th>
                <th className="text-left p-3 font-medium">Campanha</th>
                <th className="text-right p-3 font-medium">Impressoes</th>
                <th className="text-right p-3 font-medium">Cliques</th>
                <th className="text-right p-3 font-medium">CTR</th>
                <th className="text-right p-3 font-medium">CPC</th>
                <th className="text-right p-3 font-medium">Custo</th>
                <th className="text-right p-3 font-medium">Conversoes</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">{kw.text}</td>
                  <td className="p-3">
                    {matchTypeLabels[kw.matchType] ?? kw.matchType}
                  </td>
                  <td className="p-3">
                    <span className={qualityScoreColor(kw.qualityScore)}>
                      {kw.qualityScore}
                    </span>
                  </td>
                  <td className="p-3 text-white/60">{kw.campaignName}</td>
                  <td className="p-3 text-right">
                    {kw.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {kw.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {(kw.ctr * 100).toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">{formatCurrency(kw.cpc)}</td>
                  <td className="p-3 text-right">
                    {formatCurrency(kw.spend)}
                  </td>
                  <td className="p-3 text-right">{kw.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Termos de Busca */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Termos de Busca</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Termo</th>
                <th className="text-left p-3 font-medium">Campanha</th>
                <th className="text-left p-3 font-medium">Grupo</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Impressoes</th>
                <th className="text-right p-3 font-medium">Cliques</th>
                <th className="text-right p-3 font-medium">CTR</th>
                <th className="text-right p-3 font-medium">Custo</th>
                <th className="text-right p-3 font-medium">Conversoes</th>
              </tr>
            </thead>
            <tbody>
              {searchTerms.map((st, i) => {
                const statusInfo = searchTermStatusLabels[st.status] ?? {
                  label: st.status,
                  color: "text-white/40",
                };
                return (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-3">{st.searchTerm}</td>
                    <td className="p-3 text-white/60">{st.campaignName}</td>
                    <td className="p-3 text-white/60">{st.adGroupName}</td>
                    <td className="p-3">
                      <span className={statusInfo.color}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {st.impressions.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {st.clicks.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {(st.ctr * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(st.spend)}
                    </td>
                    <td className="p-3 text-right">{st.conversions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
