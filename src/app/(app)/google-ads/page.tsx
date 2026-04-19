"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Link2,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

import AccountSwitcher from "@/components/google-ads/AccountSwitcher";
import DateRangeSelector from "@/components/google-ads/DateRangeSelector";
import KpiCards from "@/components/google-ads/KpiCards";
import CampaignTable from "@/components/google-ads/CampaignTable";
import KeywordsPanel from "@/components/google-ads/KeywordsPanel";
import AudiencePanel from "@/components/google-ads/AudiencePanel";
import InsightsPanel from "@/components/google-ads/InsightsPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function GoogleAdsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Controls
  const [dateRange, setDateRange] = useState("ALL_TIME");
  const [selectedCampaign, setSelectedCampaign] = useState("all");

  // Account switching
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [currentCustomerId, setCurrentCustomerId] = useState("");
  const [hasManagedAccounts, setHasManagedAccounts] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Timestamps
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);

  // Data
  const [summary, setSummary] = useState<AnyData>(null);
  const [campaigns, setCampaigns] = useState<AnyData[]>([]);
  const [adGroups, setAdGroups] = useState<AnyData[]>([]);
  const [keywords, setKeywords] = useState<AnyData[]>([]);
  const [searchTerms, setSearchTerms] = useState<AnyData[]>([]);
  const [devices, setDevices] = useState<AnyData[]>([]);
  const [demographics, setDemographics] = useState<{ age: AnyData[]; gender: AnyData[] }>({ age: [], gender: [] });
  const [locations, setLocations] = useState<AnyData[]>([]);
  const [daily, setDaily] = useState<AnyData[]>([]);
  const [budgets, setBudgets] = useState<AnyData[]>([]);
  const [changeHistory, setChangeHistory] = useState<AnyData[]>([]);
  const [recommendations, setRecommendations] = useState<AnyData[]>([]);

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async (currentDateRange: string) => {
    setLoading(true);
    setError(null);

    try {
      // Check connection status
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
      setHasManagedAccounts(!!status.hasManagedAccounts);

      // Fetch accounts if MCC
      if (status.hasManagedAccounts && accounts.length === 0) {
        try {
          const accRes = await fetch("/api/google-ads/accounts");
          if (accRes.ok) {
            const accData = await accRes.json();
            setAccounts(accData.accounts || []);
            setCurrentCustomerId(accData.currentCustomerId || "");
          }
        } catch {
          // Non-critical, continue
        }
      }

      const dr = `?dateRange=${currentDateRange}`;
      const errors: string[] = [];

      // Fetch ALL endpoints in parallel
      const [
        summaryRes,
        campaignsRes,
        adGroupsRes,
        keywordsRes,
        searchTermsRes,
        devicesRes,
        demographicsRes,
        locationsRes,
        dailyRes,
        budgetsRes,
        changeHistoryRes,
        recommendationsRes,
      ] = await Promise.all([
        fetch(`/api/google-ads/summary${dr}`),
        fetch(`/api/google-ads/campaigns${dr}`),
        fetch(`/api/google-ads/ad-groups${dr}`),
        fetch(`/api/google-ads/keywords${dr}`),
        fetch(`/api/google-ads/search-terms${dr}`),
        fetch(`/api/google-ads/devices${dr}`),
        fetch(`/api/google-ads/demographics${dr}`),
        fetch(`/api/google-ads/locations${dr}`),
        fetch(`/api/google-ads/daily${dr}`),
        fetch(`/api/google-ads/budgets${dr}`),
        fetch(`/api/google-ads/change-history${dr}`),
        fetch(`/api/google-ads/recommendations${dr}`),
      ]);

      // Parse responses
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      } else {
        const err = await summaryRes.json().catch(() => null);
        errors.push(err?.error || `Summary falhou (${summaryRes.status})`);
      }

      if (campaignsRes.ok) {
        setCampaigns(await campaignsRes.json());
        setLastSyncAt(new Date().toISOString());
      } else {
        const err = await campaignsRes.json().catch(() => null);
        errors.push(err?.error || `Campaigns falhou (${campaignsRes.status})`);
      }

      if (adGroupsRes.ok) setAdGroups(await adGroupsRes.json());
      else errors.push("Falha ao carregar grupos de anúncios");

      if (keywordsRes.ok) setKeywords(await keywordsRes.json());
      else errors.push("Falha ao carregar palavras-chave");

      if (searchTermsRes.ok) setSearchTerms(await searchTermsRes.json());
      else errors.push("Falha ao carregar termos de busca");

      if (devicesRes.ok) setDevices(await devicesRes.json());
      else errors.push("Falha: dispositivos");

      if (demographicsRes.ok) setDemographics(await demographicsRes.json());
      else errors.push("Falha: demografia");

      if (locationsRes.ok) setLocations(await locationsRes.json());
      else errors.push("Falha: localizações");

      if (dailyRes.ok) setDaily(await dailyRes.json());
      else errors.push("Falha: performance diária");

      if (budgetsRes.ok) setBudgets(await budgetsRes.json());
      else errors.push("Falha: orçamentos");

      if (changeHistoryRes.ok) setChangeHistory(await changeHistoryRes.json());
      else errors.push("Falha: histórico");

      if (recommendationsRes.ok) setRecommendations(await recommendationsRes.json());
      else errors.push("Falha: recomendações");

      if (errors.length > 0) {
        setError(errors.join(" | "));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao conectar com a API: ${msg}`);
    }
    setLoading(false);
  }, [accounts.length]);

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange, fetchData]);

  async function handleSwitchAccount(customerId: string) {
    setSwitching(true);
    try {
      const res = await fetch("/api/google-ads/switch-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentCustomerId(data.customerId);
        setSelectedCampaign("all");
        await fetchData(dateRange);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || "Falha ao trocar conta");
      }
    } catch {
      setError("Erro ao trocar conta");
    }
    setSwitching(false);
  }

  // Campaign filter logic
  const campaignNames: string[] = campaigns
    .map((c: AnyData) => c.name || c.campaignName || "")
    .filter(Boolean);

  const filteredAdGroups =
    selectedCampaign === "all"
      ? adGroups
      : adGroups.filter(
          (ag: AnyData) =>
            (ag.campaignName || ag.campaign) === selectedCampaign
        );

  const filteredKeywords =
    selectedCampaign === "all"
      ? keywords
      : keywords.filter(
          (kw: AnyData) =>
            (kw.campaignName || kw.campaign) === selectedCampaign
        );

  const filteredSearchTerms =
    selectedCampaign === "all"
      ? searchTerms
      : searchTerms.filter(
          (st: AnyData) =>
            (st.campaignName || st.campaign) === selectedCampaign
        );

  // --- Loading state ---
  if (loading && connected === null) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-accent mx-auto mb-3 animate-pulse" />
          <p className="text-white/50">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  // --- Not connected ---
  if (connected === false) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <Link2 className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Google Ads não conectado</h2>
          <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
            Conecte sua conta Google Ads nas configurações para visualizar métricas de campanhas.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/80 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Ir para Configurações
          </Link>
        </div>
      </div>
    );
  }

  // --- Full error (no data) ---
  if (error && !summary && campaigns.length === 0) {
    const lowerError = error.toLowerCase();
    const isAccountNotEnabled =
      lowerError.includes("não está ativada") ||
      lowerError.includes("nao esta ativada") ||
      lowerError.includes("customer_not_enabled");
    const isMccMismatch =
      lowerError.includes("mcc") || lowerError.includes("developer token");
    const isTokenError =
      lowerError.includes("token") || lowerError.includes("401");

    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Google Ads</h1>
        <div className="bg-card rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">
            {isAccountNotEnabled ? "Conta Google Ads não ativada"
              : isMccMismatch ? "Conta não vinculada ao MCC"
              : isTokenError ? "Problema de autenticação"
              : "Erro ao carregar dados"}
          </h2>
          <p className="text-white/70 text-sm mb-4 max-w-lg mx-auto">{error}</p>
          {isAccountNotEnabled && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 max-w-lg mx-auto text-left">
              <p className="text-yellow-200/80 text-sm font-medium mb-2">O que fazer:</p>
              <ol className="text-yellow-200/60 text-sm space-y-1 list-decimal list-inside">
                <li>Acesse <span className="text-yellow-200/80 font-medium">ads.google.com</span></li>
                <li>Aceite os Termos de Serviço</li>
                <li>Configure o faturamento</li>
                <li>Volte e reconecte nas Configurações</li>
              </ol>
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fetchData(dateRange)}
              className="bg-accent hover:bg-accent/80 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              href="/settings"
              className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Configurações
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Google Ads</h1>
          {mounted && (connectedAt || lastSyncAt) && (
            <div className="flex items-center gap-4 text-xs text-white/40">
              {connectedAt && <span>Conectado em {formatTimestamp(connectedAt)}</span>}
              {lastSyncAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Sync: {formatTimestamp(lastSyncAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {hasManagedAccounts && (
            <AccountSwitcher
              accounts={accounts}
              currentCustomerId={currentCustomerId}
              onSwitch={handleSwitchAccount}
              loading={switching}
            />
          )}
          <DateRangeSelector value={dateRange} onChange={setDateRange} />

          {/* Campaign filter dropdown */}
          <div className="relative">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="appearance-none bg-card border border-white/10 text-white text-sm rounded-lg px-4 py-2 pr-8 focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              <option value="all">Todas as campanhas</option>
              {campaignNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Loading bar */}
      {loading && connected && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-sm text-white/60">Atualizando dados...</span>
        </div>
      )}

      {/* Partial error warning */}
      {error && (summary || campaigns.length > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-200 text-sm font-medium">Atenção</p>
            <p className="text-yellow-200/70 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* KPI Cards -- always show all 7 metrics (account total, not filtered) */}
      <KpiCards summary={summary} />

      {/* Zero metrics hint */}
      {summary && summary.impressions === 0 && summary.clicks === 0 && campaigns.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-white/80 text-sm font-medium">Campanhas sem dados</p>
            <p className="text-white/50 text-sm">
              Suas campanhas foram encontradas, mas nenhuma gerou impressões.
              Verifique no Google Ads se a configuração está completa.
            </p>
          </div>
        </div>
      )}

      {/* Performance chart section -- daily performance + insights */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Performance e Insights</h2>
        <InsightsPanel
          daily={daily}
          budgets={budgets}
          changeHistory={changeHistory}
          recommendations={recommendations}
        />
      </div>

      {/* Campaigns table -- all columns, expandable ad groups */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Campanhas</h2>
        <CampaignTable
          campaigns={campaigns}
          adGroups={filteredAdGroups}
        />
      </div>

      {/* Keywords section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Palavras-chave</h2>
        <KeywordsPanel keywords={filteredKeywords} searchTerms={filteredSearchTerms} />
      </div>

      {/* Audience section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Audiência</h2>
        <AudiencePanel
          devices={devices}
          demographics={demographics}
          locations={locations}
        />
      </div>
    </div>
  );
}
