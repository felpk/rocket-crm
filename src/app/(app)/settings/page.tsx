"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, Link2, Link2Off, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface GoogleAdsStatus {
  connected: boolean;
  assignedByAdmin?: boolean;
  customerId?: string;
  accountName?: string;
}

interface UserSession {
  role: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [gadsStatus, setGadsStatus] = useState<GoogleAdsStatus | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const justConnected = searchParams.get("connected") === "google-ads";
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("detail");

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    Promise.all([fetchSession(), fetchGadsStatus()]).then(() => setLoading(false));
  }, []);

  async function fetchSession() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setSession(data.user || data);
      }
    } catch {}
  }

  async function fetchGadsStatus() {
    try {
      const res = await fetch("/api/google-ads/status");
      if (res.ok) setGadsStatus(await res.json());
      else setGadsStatus({ connected: false });
    } catch {
      setGadsStatus({ connected: false });
    }
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
              {error === "google-ads-no-client-accounts" && "O MCC conectado não possui contas cliente. Adicione uma conta no Google Ads."}
              {error === "google-ads-failed" && "Erro ao conectar com Google Ads."}
              {error === "google-ads-invalid-state" && "Sessão expirada. Tente novamente."}
              {error === "google-ads-mcc-mismatch" &&
                "A conta Google Ads conectada não pertence ao MCC (conta gerenciadora) configurado neste app. Conecte com a conta Google que administra o MCC do developer token, ou vincule esta conta ao MCC no Google Ads."}
              {error === "google-ads-manager-needs-login-id" &&
                "A conta selecionada é uma conta gerenciadora (MCC) e não pode ser consultada diretamente. Desconecte e reconecte selecionando uma conta cliente."}
              {error === "google-ads-token-expired" &&
                "Token de autenticação expirado. Tente reconectar sua conta Google Ads."}
              {error === "google-ads-token-revoked" &&
                "O acesso ao Google Ads foi revogado. Reconecte sua conta."}
              {error === "google-ads-account-not-enabled" &&
                "A conta Google Ads existe mas não está ativada ou não completou a configuração. Acesse ads.google.com com a conta conectada, aceite os Termos de Serviço e configure o faturamento. Após ativar, volte aqui e reconecte."}
              {error === "google-ads-account-suspended" &&
                "A conta Google Ads está suspensa ou cancelada. Verifique o status em ads.google.com."}
              {error === "google-ads-not-ads-user" &&
                "Esta conta Google não possui uma conta Google Ads. Crie uma em ads.google.com primeiro."}
              {error === "google-ads-permission-denied" &&
                "Sem permissão para acessar esta conta Google Ads. Verifique se a conta está vinculada ao MCC do developer token e tente reconectar."}
              {error === "google-ads-developer-token" &&
                "Erro de configuração do developer token. Contate o suporte técnico."}
              {error === "google-ads-unknown" && "Erro desconhecido ao conectar com Google Ads."}
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
        ) : isAdmin ? (
          /* --- ADMIN VIEW --- */
          gadsStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium">MCC Conectado</p>
                  <p className="text-sm text-white/50">
                    Customer ID: {gadsStatus.customerId}
                    {gadsStatus.accountName && ` — ${gadsStatus.accountName}`}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                Gerencie a atribuição de contas aos clientes no Painel Administrativo.
              </p>
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
                Conecte a conta MCC do Google Ads para gerenciar as campanhas dos clientes.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                {connecting ? "Redirecionando..." : "Conectar Google Ads (MCC)"}
              </button>
            </div>
          )
        ) : (
          /* --- CLIENT VIEW --- */
          gadsStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium">Conectado pela Rocket</p>
                  <p className="text-sm text-white/50">
                    Conta: {gadsStatus.accountName || gadsStatus.customerId}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                Sua conta Google Ads foi configurada pelo administrador. Acesse a página Google Ads para ver suas métricas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-white/30" />
                <div>
                  <p className="font-medium text-white/60">Aguardando configuração</p>
                  <p className="text-sm text-white/40">
                    O administrador da Rocket irá configurar sua conta Google Ads em breve.
                  </p>
                </div>
              </div>
            </div>
          )
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
