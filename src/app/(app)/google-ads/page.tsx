"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Eye,
  MousePointer,
  Percent,
  DollarSign,
  Link2,
} from "lucide-react";
import Link from "next/link";

interface Summary {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
}

interface Campaign {
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function GoogleAdsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    checkAndLoad();
  }, []);

  async function checkAndLoad() {
    setLoading(true);
    try {
      const statusRes = await fetch("/api/google-ads/status");
      const status = await statusRes.json();

      if (!status.connected) {
        setConnected(false);
        setLoading(false);
        return;
      }

      setConnected(true);
      if (status.lastSyncAt) setLastSyncAt(status.lastSyncAt);
      if (status.connectedAt) setConnectedAt(status.connectedAt);

      const [summaryRes, campaignsRes] = await Promise.all([
        fetch("/api/google-ads/summary"),
        fetch("/api/google-ads/campaigns"),
      ]);

      const errors: string[] = [];

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      } else {
        const errData = await summaryRes.json().catch(() => null);
        const msg = errData?.error || `Summary falhou (${summaryRes.status})`;
        const details = errData?.details || "";
        errors.push(msg);
        console.error("[Google Ads] Summary error:", msg, details);
      }

      if (campaignsRes.ok) {
        setCampaigns(await campaignsRes.json());
        setLastSyncAt(new Date().toISOString());
      } else {
        const errData = await campaignsRes.json().catch(() => null);
        const msg = errData?.error || `Campaigns falhou (${campaignsRes.status})`;
        const details = errData?.details || "";
        errors.push(msg);
        console.error("[Google Ads] Campaigns error:", msg, details);
      }

      if (errors.length > 0) {
        setError(errors.join(" | "));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Google Ads] Fetch error:", msg);
      setError(`Erro ao conectar com a API: ${msg}`);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-accent mx-auto mb-3 animate-pulse" />
          <p className="text-white/50">Carregando metricas...</p>
        </div>
      </div>
    );
  }

  if (connected === false) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <Link2 className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">
            Google Ads nao conectado
          </h2>
          <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
            Conecte sua conta Google Ads nas configuracoes para visualizar
            metricas de campanhas.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/80 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Ir para Configuracoes
          </Link>
        </div>
      </div>
    );
  }

  // If error and no data at all, show full-page error
  if (error && !summary && campaigns.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Erro ao carregar dados</h2>
          <p className="text-white/70 text-sm mb-6 max-w-lg mx-auto">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={checkAndLoad}
              className="bg-accent hover:bg-accent/80 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              href="/settings"
              className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Configuracoes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    ENABLED: { text: "Ativo", color: "bg-success/20 text-success" },
    PAUSED: { text: "Pausado", color: "bg-white/10 text-white/50" },
    REMOVED: { text: "Removido", color: "bg-error/20 text-error" },
  };

  const kpis = [
    {
      label: "Impressoes",
      value: summary?.impressions.toLocaleString("pt-BR") ?? "0",
      icon: Eye,
      color: "text-accent",
    },
    {
      label: "Cliques",
      value: summary?.clicks.toLocaleString("pt-BR") ?? "0",
      icon: MousePointer,
      color: "text-success",
    },
    {
      label: "CTR",
      value: `${((summary?.ctr ?? 0) * 100).toFixed(2)}%`,
      icon: Percent,
      color: "text-warning",
    },
    {
      label: "Investimento",
      value: formatCurrency(summary?.spend ?? 0),
      icon: DollarSign,
      color: "text-accent",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Google Ads</h1>
        {mounted && (connectedAt || lastSyncAt) && (
          <div className="flex items-center gap-4 text-xs text-white/40">
            {connectedAt && (
              <span>Conectado em {formatTimestamp(connectedAt)}</span>
            )}
            {lastSyncAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Ultima sincronizacao: {formatTimestamp(lastSyncAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Warning banner for partial errors */}
      {error && (summary || campaigns.length > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-200 text-sm font-medium">Atencao</p>
            <p className="text-yellow-200/70 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/60">{kpi.label}</span>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Zero metrics hint */}
      {summary && summary.impressions === 0 && summary.clicks === 0 && campaigns.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white/80 text-sm font-medium">Campanhas sem dados</p>
            <p className="text-white/50 text-sm">
              Suas campanhas foram encontradas, mas nenhuma gerou impressoes nos
              ultimos 30 dias. Verifique no Google Ads se a configuracao esta
              completa: anuncios aprovados, palavras-chave, orcamento definido e
              faturamento ativo.
            </p>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      <h2 className="text-lg font-semibold mb-4">Campanhas</h2>
      <div className="bg-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-4">Campanha</th>
                <th className="text-center p-4">Status</th>
                <th className="text-right p-4">Impressoes</th>
                <th className="text-right p-4">Cliques</th>
                <th className="text-right p-4">CTR</th>
                <th className="text-right p-4">CPC</th>
                <th className="text-right p-4">Custo</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const st = statusLabel[c.status] ?? {
                  text: c.status,
                  color: "bg-white/10 text-white/50",
                };
                return (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4 font-medium">{c.name}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}
                      >
                        {st.text}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {c.impressions.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-4 text-right">
                      {c.clicks.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-4 text-right">
                      {(c.ctr * 100).toFixed(2)}%
                    </td>
                    <td className="p-4 text-right">
                      {formatCurrency(c.cpc)}
                    </td>
                    <td className="p-4 text-right">
                      {formatCurrency(c.spend)}
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40">
                    <p>Nenhuma campanha encontrada nos ultimos 30 dias.</p>
                    <p className="text-xs mt-1">
                      Se voce criou campanhas recentemente, verifique se estao
                      ativas e com configuracao completa (anuncios, palavras-chave
                      e faturamento) no Google Ads.
                    </p>
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
