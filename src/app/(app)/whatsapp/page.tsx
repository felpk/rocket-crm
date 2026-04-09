"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Wifi, WifiOff, Send } from "lucide-react";

interface ConnectionState {
  instance: { instanceName: string; state: string };
}

export default function WhatsAppPage() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  async function checkConnection() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      }
    } catch {
      setConnection(null);
    }
    setLoading(false);
  }

  async function loadQrCode() {
    setQrLoading(true);
    setQrError(null);
    setQrData(null);
    try {
      const res = await fetch("/api/whatsapp/qrcode");
      const data = await res.json();
      if (!res.ok) {
        setQrError(data.error || "Erro ao gerar QR Code");
        return;
      }
      if (data.base64) {
        setQrData(data.base64);
      } else {
        setQrError("QR Code não retornado pela API");
      }
    } catch {
      setQrError("Erro de conexão ao gerar QR Code");
    } finally {
      setQrLoading(false);
    }
  }

  useEffect(() => {
    checkConnection();
  }, []);

  const isConnected = connection?.instance?.state === "open";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !message) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), text: message }),
      });
      if (res.ok) {
        setResult("Mensagem enviada com sucesso!");
        setMessage("");
      } else {
        const data = await res.json();
        setResult(`Erro: ${data.error}`);
      }
    } catch {
      setResult("Erro ao enviar mensagem");
    }
    setSending(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">WhatsApp</h1>

      {/* Connection status */}
      <div className="bg-card rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="w-6 h-6 text-success" />
            ) : (
              <WifiOff className="w-6 h-6 text-error" />
            )}
            <div>
              <h2 className="font-semibold">Status da Conexão</h2>
              <p className="text-sm text-white/60">
                Instância: {connection?.instance?.instanceName || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isConnected
                  ? "bg-success/20 text-success"
                  : "bg-error/20 text-error"
              }`}
            >
              {loading
                ? "Verificando..."
                : isConnected
                ? "Conectado"
                : "Desconectado"}
            </span>
            <button
              onClick={checkConnection}
              className="text-sm text-accent hover:underline"
            >
              Atualizar
            </button>
          </div>
        </div>

        {!isConnected && !loading && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={loadQrCode}
              disabled={qrLoading}
              className="bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {qrLoading ? "Gerando..." : "Gerar QR Code"}
            </button>
            {qrError && (
              <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-error/20 text-error">
                {qrError}
              </div>
            )}
            {qrData && (
              <div className="mt-4 flex justify-center">
                <img
                  src={qrData}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 rounded-lg bg-white p-2"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send message */}
      {isConnected && (
        <div className="bg-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">Enviar Mensagem</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Número (com DDD e código do país)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999999999"
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !phone || !message}
              className="flex items-center gap-2 bg-success hover:bg-success/80 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </form>

          {result && (
            <div
              className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                result.startsWith("Erro")
                  ? "bg-error/20 text-error"
                  : "bg-success/20 text-success"
              }`}
            >
              {result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
