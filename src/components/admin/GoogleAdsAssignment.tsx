"use client";

import { useEffect, useState } from "react";
import { BarChart3, UserPlus, X, RefreshCw, CheckCircle } from "lucide-react";

interface ManagedAccount {
  id: string;
  name: string;
}

interface Assignment {
  customerId: string;
  accountName: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCompany: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

export default function GoogleAdsAssignment({ clients }: { clients: Client[] }) {
  const [connected, setConnected] = useState(false);
  const [mccId, setMccId] = useState("");
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/google-ads-accounts");
      if (!res.ok) throw new Error("Falha ao carregar contas");
      const data = await res.json();
      setConnected(data.connected);
      setMccId(data.mccId || "");
      setAccounts(data.accounts || []);
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }

  async function assign(userId: string, customerId: string | null) {
    setAssigning(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/google-ads-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, customerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");

      if (data.action === "assigned") {
        setSuccess(`Conta ${data.accountName} atribuida com sucesso`);
      } else {
        setSuccess("Conta desatribuida com sucesso");
      }
      await loadAccounts();
    } catch (err) {
      setError(String(err));
    }
    setAssigning(null);
  }

  function getAssignmentForAccount(accountId: string) {
    return assignments.find(a => a.customerId === accountId);
  }

  function getAssignmentForClient(clientId: string) {
    return assignments.find(a => a.userId === clientId);
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-lg">Google Ads — Contas</h2>
        </div>
        <p className="text-white/50 text-sm animate-pulse">Carregando contas do MCC...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-lg">Google Ads — Contas</h2>
        </div>
        <p className="text-white/50 text-sm">
          Conecte sua conta MCC do Google Ads nas{" "}
          <a href="/settings" className="text-accent underline">Configuracoes</a>{" "}
          para poder atribuir contas aos clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-accent" />
          <div>
            <h2 className="font-semibold text-lg">Google Ads — Contas</h2>
            <p className="text-xs text-white/40">MCC: {mccId} — {accounts.length} contas gerenciadas</p>
          </div>
        </div>
        <button
          onClick={loadAccounts}
          className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </button>
      </div>

      {success && (
        <div className="bg-success/20 border border-success/30 text-success px-3 py-2 rounded-lg mb-4 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-error/20 border border-error/30 text-error px-3 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="text-white/50 text-sm">Nenhuma conta gerenciada encontrada no MCC.</p>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => {
            const assignment = getAssignmentForAccount(account.id);
            return (
              <div
                key={account.id}
                className="flex items-center justify-between gap-4 bg-white/5 rounded-lg px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{account.name}</p>
                  <p className="text-xs text-white/40">ID: {account.id}</p>
                </div>

                {assignment ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-success font-medium">{assignment.userName}</p>
                      <p className="text-xs text-white/40">{assignment.userEmail}</p>
                    </div>
                    <button
                      onClick={() => assign(assignment.userId, null)}
                      disabled={assigning === assignment.userId}
                      className="p-1.5 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors disabled:opacity-50"
                      title="Desatribuir"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <select
                    onChange={(e) => {
                      if (e.target.value) assign(e.target.value, account.id);
                    }}
                    disabled={assigning !== null}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-accent disabled:opacity-50 max-w-[200px]"
                    value=""
                  >
                    <option value="">Atribuir a...</option>
                    {clients
                      .filter(c => !getAssignmentForClient(c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ""}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Clients without Google Ads */}
      {(() => {
        const unassigned = clients.filter(c => !getAssignmentForClient(c.id));
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2">
              {unassigned.length} cliente(s) sem conta Google Ads atribuida
            </p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(c => (
                <span key={c.id} className="text-xs bg-white/5 text-white/50 px-2 py-1 rounded">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
