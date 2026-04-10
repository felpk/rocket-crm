"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, Link2, Link2Off, CheckCircle, AlertCircle } from "lucide-react";

interface GoogleAdsStatus {
  connected: boolean;
  customerId?: string;
  accountName?: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [gadsStatus, setGadsStatus] = useState<GoogleAdsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const justConnected = searchParams.get("connected") === "google-ads";
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("detail");

  useEffect(() => {
    fetchGadsStatus();
  }, []);

  async function fetchGadsStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/google-ads/status");
      if (res.ok) setGadsStatus(await res.json());
    } catch {
      setGadsStatus({ connected: false });
    }
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/google-ads/auth");
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar sua conta Google Ads?")) return;
    await fetch("/api/google-ads/disconnect", { method: "POST" });
    setGadsStatus({ connected: false });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>

      {/* Success/Error messages */}
      {justConnected && (
        <div className="bg-success/20 border border-success/30 text-success px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Google Ads conectado com sucesso!
        </div>
      )}
      {error && (
        <div className="bg-error/20 border border-error/30 text-error px-4 py-3 rounded-lg mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              {error === "google-ads-denied" && "Acesso ao Google Ads foi negado."}
              {error === "google-ads-no-accounts" && "Nenhuma conta Google Ads encontrada. Verifique se a conta tem acesso ao Google Ads."}
              {error === "google-ads-failed" && "Erro ao conectar com Google Ads."}
              {error === "google-ads-invalid-state" && "Sessão expirada. Tente novamente."}
            </span>
          </div>
          {errorDetail && (
            <pre className="mt-2 text-xs text-white/50 whitespace-pre-wrap break-all bg-black/20 rounded p-2 select-text cursor-text">
              {errorDetail}
            </pre>
          )}
        </div>
      )}

      {/* Google Ads Connection */}
      <div className="bg-card rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-lg">Google Ads</h2>
        </div>

        {loading ? (
          <p className="text-white/50 text-sm">Verificando conexão...</p>
        ) : gadsStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-success" />
              <div>
                <p className="font-medium">Conectado</p>
                <p className="text-sm text-white/50">
                  Customer ID: {gadsStatus.customerId}
                  {gadsStatus.accountName && ` — ${gadsStatus.accountName}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 bg-error/20 hover:bg-error/30 text-error px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Link2Off className="w-4 h-4" />
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white/60">
              Conecte sua conta Google Ads para visualizar métricas de campanhas
              diretamente no CRM.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {connecting ? "Redirecionando..." : "Conectar Google Ads"}
            </button>
          </div>
        )}
      </div>

      {/* Placeholder sections */}
      <div className="bg-card rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-lg">Perfil</h2>
        </div>
        <p className="text-sm text-white/50">
          Edição de perfil será disponibilizada em breve.
        </p>
      </div>
    </div>
  );
}
