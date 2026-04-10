"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  Send,
  Search,
  ArrowLeft,
  User,
  Plus,
  Trash2,
} from "lucide-react";

interface ConnectionState {
  instance: { instanceName: string; state: string } | null;
  status?: string;
}

interface Conversation {
  id: string;
  name: string;
  phone: string;
  lastMessage: string | null;
  lastMessageAt: string;
  lastMessageFromMe: boolean | null;
}

interface Message {
  id: string;
  content: string;
  fromMe: boolean;
  timestamp: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

export default function WhatsAppPage() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Connection check
  async function checkConnection() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        setConnection(await res.json());
      } else {
        console.error("[WhatsApp] Falha ao verificar status:", res.status);
        setConnection(null);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao verificar conexão:", err);
      setConnection(null);
    }
    setLoading(false);
  }

  // Create instance
  async function handleCreateInstance() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.qrcode?.base64) {
          setQrData(data.qrcode.base64);
        }
        await checkConnection();
      } else {
        console.error("[WhatsApp] Falha ao criar instância:", data);
        setError(`Erro ao criar instância: ${data.error || res.status}`);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao criar instância:", err);
      setError("Erro de conexão ao criar instância");
    }
    setCreating(false);
  }

  // Disconnect instance
  async function handleDisconnect() {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp?")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "DELETE" });
      if (res.ok) {
        setConnection(null);
        setQrData(null);
        setConversations([]);
        setSelectedLeadId(null);
        setMessages([]);
        await checkConnection();
      } else {
        const data = await res.json();
        console.error("[WhatsApp] Falha ao desconectar:", data);
        setError(`Erro ao desconectar: ${data.error || res.status}`);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao desconectar:", err);
      setError("Erro de conexão ao desconectar");
    }
    setDisconnecting(false);
  }

  // Load QR code
  async function loadQrCode() {
    try {
      const res = await fetch("/api/whatsapp/qrcode");
      if (res.ok) {
        const data = await res.json();
        if (data.base64) setQrData(data.base64);
      } else {
        console.error("[WhatsApp] Falha ao gerar QR:", res.status);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao gerar QR:", err);
    }
  }

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (res.ok) {
        setConversations(await res.json());
      } else {
        console.error("[WhatsApp] Falha ao carregar conversas:", res.status);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao carregar conversas:", err);
    }
  }, []);

  // Fetch messages for selected lead
  const fetchMessages = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(
        `/api/whatsapp/conversations/${leadId}/messages`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedLead(data.lead);
        setMessages(data.messages);
      } else {
        console.error("[WhatsApp] Falha ao carregar mensagens:", res.status);
        setError("Falha ao carregar mensagens");
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao carregar mensagens:", err);
      setError("Erro ao carregar mensagens");
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkConnection();
  }, []);

  const hasInstance = connection?.instance !== null && connection?.status !== "no_instance";
  const isConnected = connection?.instance?.state === "open";

  // Load conversations when connected
  useEffect(() => {
    if (!isConnected) return;
    setLoadingConversations(true);
    fetchConversations().finally(() => setLoadingConversations(false));

    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [isConnected, fetchConversations]);

  // Load messages when lead selected
  useEffect(() => {
    if (!selectedLeadId) return;
    setLoadingMessages(true);
    fetchMessages(selectedLeadId).finally(() => setLoadingMessages(false));

    const interval = setInterval(() => fetchMessages(selectedLeadId), 5000);
    return () => clearInterval(interval);
  }, [selectedLeadId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  async function handleSend() {
    if (!messageInput.trim() || !selectedLeadId || sending) return;
    const text = messageInput.trim();
    setMessageInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLeadId, text }),
      });

      if (res.ok) {
        await fetchMessages(selectedLeadId);
        await fetchConversations();
      } else {
        const data = await res.json();
        console.error("[WhatsApp] Falha ao enviar:", data);
        setError(`Erro ao enviar: ${data.error || res.status}`);
        setMessageInput(text);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao enviar mensagem:", err);
      setError("Erro de conexão ao enviar mensagem");
      setMessageInput(text);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function selectConversation(leadId: string) {
    setSelectedLeadId(leadId);
    setMessages([]);
    setError(null);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-muted-fg">Verificando conexão...</div>
      </div>
    );
  }

  // No instance — show create button
  if (!hasInstance) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">WhatsApp</h1>
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg text-sm bg-error/20 text-error">
            {error}
          </div>
        )}
        <div className="bg-card border border-border/50 rounded-xl p-8 text-center">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-fg opacity-30" />
          <h2 className="text-lg font-semibold mb-2">
            Conecte seu WhatsApp
          </h2>
          <p className="text-sm text-muted-fg mb-6 max-w-md mx-auto">
            Crie uma conexão para enviar e receber mensagens pelo WhatsApp
            diretamente no CRM.
          </p>
          <button
            onClick={handleCreateInstance}
            disabled={creating}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/80 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {creating ? "Criando..." : "Criar Conexão WhatsApp"}
          </button>
        </div>
      </div>
    );
  }

  // Has instance but not connected — show QR code
  if (!isConnected) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">WhatsApp</h1>
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg text-sm bg-error/20 text-error">
            {error}
          </div>
        )}
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WifiOff className="w-6 h-6 text-error" />
              <div>
                <h2 className="font-semibold">Status da Conexão</h2>
                <p className="text-sm text-muted-fg">
                  Instância: {connection?.instance?.instanceName || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-error/20 text-error">
                Desconectado
              </span>
              <button
                onClick={checkConnection}
                className="text-sm text-accent hover:underline"
              >
                Atualizar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-sm text-error hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                {disconnecting ? "..." : "Remover"}
              </button>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-fg mb-3">
              Escaneie o QR Code com seu WhatsApp para conectar.
            </p>
            <button
              onClick={loadQrCode}
              className="bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Gerar QR Code
            </button>
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
        </div>
      </div>
    );
  }

  // Connected — Chat UI
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success flex items-center gap-1">
            <Wifi className="w-3 h-3" /> Conectado
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-sm text-error hover:underline flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          {disconnecting ? "Desconectando..." : "Desconectar"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm bg-error/20 text-error flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-error hover:text-error/80 ml-2"
          >
            x
          </button>
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 min-h-0 bg-card border border-border/50 rounded-xl overflow-hidden">
        {/* Conversation list */}
        <div
          className={`w-full md:w-80 md:min-w-[320px] border-r border-border flex flex-col ${
            selectedLeadId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-fg" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations && conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-fg">
                Carregando conversas...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-fg">
                {searchQuery
                  ? "Nenhuma conversa encontrada"
                  : "Nenhum lead com telefone cadastrado"}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/50 transition-colors ${
                    selectedLeadId === conv.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conv.name}
                        </span>
                        <span className="text-xs text-muted-fg flex-shrink-0 ml-2">
                          {conv.lastMessage
                            ? formatTime(conv.lastMessageAt)
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-fg truncate mt-0.5">
                        {conv.lastMessage
                          ? `${conv.lastMessageFromMe ? "Você: " : ""}${conv.lastMessage}`
                          : conv.phone}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div
          className={`flex-1 flex flex-col ${
            selectedLeadId ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedLeadId && selectedLead ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <button
                  onClick={() => setSelectedLeadId(null)}
                  className="md:hidden text-muted-fg hover:text-foreground"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">
                    {selectedLead.name}
                  </h3>
                  <p className="text-xs text-muted-fg">
                    {selectedLead.phone}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingMessages && messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-fg py-8">
                    Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-fg py-8">
                    Nenhuma mensagem ainda. Envie a primeira!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2 ${
                          msg.fromMe
                            ? "bg-[#005c4b] text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.fromMe ? "text-white/60" : "text-muted-fg"
                          }`}
                        >
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-border">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    className="flex-1 bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none max-h-32"
                    style={{
                      height: "auto",
                      minHeight: "42px",
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height =
                        Math.min(target.scrollHeight, 128) + "px";
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !messageInput.trim()}
                    className="bg-accent hover:bg-accent/80 p-2.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Empty state
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-fg">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">
                  Selecione uma conversa
                </p>
                <p className="text-sm mt-1">
                  Escolha um contato para iniciar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
