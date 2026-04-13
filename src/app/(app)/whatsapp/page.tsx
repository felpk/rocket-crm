"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  Send,
  Search,
  ArrowLeft,
  Phone,
  User,
  Users,
  Clock,
  CheckCheck,
  Check,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Types ───────── */

interface ConnectionState {
  instance: { instanceName: string; state: string };
}

interface Conversation {
  leadId: string;
  name: string;
  phone: string | null;
  stage: string;
  lastMessage: {
    content: string;
    fromMe: boolean;
    timestamp: string;
  } | null;
  messageCount: number;
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
  phone: string | null;
  stage: string;
  email: string | null;
  company: string | null;
}

/* ───────── Helpers ───────── */

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualification: "Qualificacao",
  meeting: "Reuniao",
  proposal: "Proposta",
  negotiation: "Negociacao",
  closed: "Fechado",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500/20 text-blue-400",
  qualification: "bg-yellow-500/20 text-yellow-400",
  meeting: "bg-purple-500/20 text-purple-400",
  proposal: "bg-orange-500/20 text-orange-400",
  negotiation: "bg-cyan-500/20 text-cyan-400",
  closed: "bg-green-500/20 text-green-400",
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 9)
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
}

function isPhoneNumber(value: string): boolean {
  return /^\d{8,15}$/.test(value.replace(/\D/g, ""));
}

function formatContactDisplay(name: string, phone: string | null): { displayName: string; subtitle: string } {
  const formattedPhone = phone ? formatPhone(phone) : "";
  // If name is same as phone (or just digits), show formatted phone as name
  if (!name || name === phone || isPhoneNumber(name)) {
    return { displayName: formattedPhone || name, subtitle: "" };
  }
  // Name is different from phone — show "Name - +55 (91) 98522-2088"
  return {
    displayName: formattedPhone ? `${name} - ${formattedPhone}` : name,
    subtitle: "",
  };
}

/* ───────── Templates ───────── */

const TEMPLATE_MESSAGES = [
  { label: "Boas-vindas", text: "Ola! Seja bem-vindo(a) a Rocket Marketing. Como posso ajudar?" },
  { label: "Follow-up", text: "Ola! Tudo bem? Estou entrando em contato para dar continuidade a nossa conversa." },
  { label: "Agendamento", text: "Ola! Gostaria de agendar uma reuniao para conversarmos. Qual o melhor horario?" },
  { label: "Proposta", text: "Ola! Conforme conversamos, estou enviando a proposta para sua analise." },
];

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export default function WhatsAppPage() {
  // Connection
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [connLoading, setConnLoading] = useState(true);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrTimer, setQrTimer] = useState(0);
  const [qrExpired, setQrExpired] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Conversations & Contacts
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");

  // Active chat
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  // Send
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // New conversation
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPhone, setNewPhone] = useState("");

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Sync all
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<string | null>(null);

  // Mobile: show chat panel
  const [showChat, setShowChat] = useState(false);

  // QR modal
  const [showQrModal, setShowQrModal] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; leadId: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = connection?.instance?.state === "open";

  /* ───────── Connection ───────── */

  async function checkConnection() {
    setConnLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
        if (data?.instance?.state === "open") {
          setQrData(null);
          stopQrPolling();
        }
      }
    } catch {
      setConnection(null);
    }
    setConnLoading(false);
  }

  function stopQrPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (qrRefreshRef.current) { clearInterval(qrRefreshRef.current); qrRefreshRef.current = null; }
  }

  async function refreshQrCode() {
    try {
      const res = await fetch("/api/whatsapp/qrcode");
      const data = await res.json();
      if (res.ok && data.base64) setQrData(data.base64);
    } catch { /* ignore */ }
  }

  function startQrPolling() {
    stopQrPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (res.ok) {
          const data = await res.json();
          setConnection(data);
          if (data?.instance?.state === "open") {
            setQrData(null);
            setQrError(null);
            setShowQrModal(false);
            stopQrPolling();
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    qrRefreshRef.current = setInterval(refreshQrCode, 30000);
  }

  async function loadQrCode() {
    setQrLoading(true);
    setQrError(null);
    setQrData(null);
    setShowQrModal(true);
    try {
      const res = await fetch("/api/whatsapp/qrcode");
      const data = await res.json();
      if (!res.ok) { setQrError(data.error || "Erro ao gerar QR Code"); return; }
      if (data.base64) { setQrData(data.base64); startQrPolling(); }
      else setQrError("QR Code nao retornado pela API");
    } catch {
      setQrError("Erro de conexao ao gerar QR Code");
    } finally {
      setQrLoading(false);
    }
  }

  /* ───────── Conversations ───────── */

  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (res.ok) {
        const data = await res.json();
        // Support both old format (array) and new format ({ conversations, contacts })
        if (Array.isArray(data)) {
          setConversations(data);
          setContacts([]);
        } else {
          setConversations(data.conversations || []);
          setContacts(data.contacts || []);
        }
      }
    } catch { /* ignore */ }
    setConvsLoading(false);
  }, []);

  /* ───────── Messages ───────── */

  const loadMessages = useCallback(async (leadId: string) => {
    setMsgsLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveLead(data.lead);
        setMessages(data.messages);
      }
    } catch { /* ignore */ }
    setMsgsLoading(false);
  }, []);

  function openChat(leadId: string) {
    setActiveLeadId(leadId);
    setShowChat(true);
    loadMessages(leadId);
  }

  function closeChat() {
    setShowChat(false);
    setActiveLeadId(null);
    setActiveLead(null);
    setMessages([]);
    if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // QR Code expiration countdown
  useEffect(() => {
    if (!qrData) {
      setQrTimer(0);
      return;
    }
    setQrExpired(false);
    setQrTimer(40);
    const interval = setInterval(() => {
      setQrTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setQrData(null);
          setQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrData]);

  // Poll messages when chat is open and connected
  useEffect(() => {
    if (activeLeadId && isConnected) {
      msgPollRef.current = setInterval(() => {
        loadMessages(activeLeadId);
      }, 5000);
    }
    return () => {
      if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
    };
  }, [activeLeadId, isConnected, loadMessages]);

  /* ───────── Sync messages ───────── */

  async function handleSync() {
    if (!activeLeadId || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/whatsapp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: activeLeadId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`${data.synced} mensagens sincronizadas`);
        await loadMessages(activeLeadId);
        loadConversations();
      } else {
        setSyncResult(`Erro: ${data.error}`);
      }
    } catch {
      setSyncResult("Erro ao sincronizar");
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 4000);
  }

  /* ───────── Sync all chats from WhatsApp ───────── */

  async function handleSyncAll() {
    if (syncingAll) return;
    setSyncingAll(true);
    setSyncAllResult(null);
    try {
      const res = await fetch("/api/whatsapp/sync-all", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSyncAllResult(`${data.importedContacts} contatos, ${data.importedMessages} mensagens importadas`);
        await loadConversations();
      } else {
        setSyncAllResult(`Erro: ${data.error}`);
      }
    } catch {
      setSyncAllResult("Erro ao sincronizar");
    }
    setSyncingAll(false);
    setTimeout(() => setSyncAllResult(null), 6000);
  }

  /* ───────── Delete conversation ───────── */

  async function handleDeleteConversation(leadId: string) {
    setContextMenu(null);
    if (!confirm("Tem certeza que deseja apagar esta conversa? Todas as mensagens serão removidas.")) return;

    try {
      const res = await fetch(`/api/whatsapp/conversations/${leadId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeLeadId === leadId) closeChat();
        await loadConversations();
      }
    } catch { /* ignore */ }
  }

  /* ───────── Send message ───────── */

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;

    const phone = activeLead?.phone || newPhone.replace(/\D/g, "");
    if (!phone) return;

    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          text,
          leadId: activeLeadId,
        }),
      });
      if (res.ok) {
        setNewMessage("");
        if (activeLeadId) await loadMessages(activeLeadId);
        loadConversations();
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  /* ───────── New conversation send ───────── */

  async function handleNewChatSend(e: React.FormEvent) {
    e.preventDefault();
    const text = newMessage.trim();
    const phone = newPhone.replace(/\D/g, "");
    if (!text || !phone) return;

    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewMessage("");
        setNewPhone("");
        setShowNewChat(false);
        await loadConversations();
        if (data.leadId) {
          openChat(data.leadId);
        }
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  /* ───────── Init ───────── */

  useEffect(() => {
    checkConnection();
    loadConversations();
    return () => stopQrPolling();
  }, [loadConversations]);

  useEffect(() => {
    if (isConnected) loadConversations();
  }, [isConnected, loadConversations]);

  /* ───────── Close context menu on click anywhere ───────── */

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  /* ───────── Filter ───────── */

  const currentList = activeTab === "conversas" ? conversations : contacts;
  const filtered = currentList.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.lastMessage?.content.toLowerCase().includes(term))
    );
  });

  /* ───────── Render conversation item ───────── */

  function renderConvItem(conv: Conversation) {
    const { displayName } = formatContactDisplay(conv.name, conv.phone);
    const initial = (conv.name && !isPhoneNumber(conv.name)) ? conv.name.charAt(0).toUpperCase() : (conv.phone ? conv.phone.charAt(0) : "?");
    return (
      <button
        key={conv.leadId}
        onClick={() => openChat(conv.leadId)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, leadId: conv.leadId });
        }}
        className={cn(
          "w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5",
          activeLeadId === conv.leadId && "bg-white/10"
        )}
      >
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-accent">
            {initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm truncate">{displayName}</span>
            {conv.lastMessage && (
              <span className="text-xs text-white/40 flex-shrink-0 ml-2">
                {formatTime(conv.lastMessage.timestamp)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {conv.lastMessage?.fromMe && (
              <CheckCheck className="w-3 h-3 text-accent flex-shrink-0" />
            )}
            <p className="text-xs text-white/50 truncate">
              {conv.lastMessage?.content || "Sem mensagens"}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-xs px-1.5 py-0.5 rounded", STAGE_COLORS[conv.stage] || "bg-white/10 text-white/50")}>
              {STAGE_LABELS[conv.stage] || conv.stage}
            </span>
          </div>
        </div>
      </button>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  if (connLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">WhatsApp</h1>
        <div className="bg-card rounded-xl p-6 text-center text-white/60">
          Verificando conexao...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          {isConnected ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
              <Wifi className="w-3 h-3" />
              Conectado
            </span>
          ) : (
            <button
              onClick={loadQrCode}
              disabled={qrLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-error/20 text-error hover:bg-error/30 transition-colors"
            >
              <WifiOff className="w-3 h-3" />
              {qrLoading ? "Conectando..." : "Desconectado — Conectar"}
            </button>
          )}
          {isConnected && (
            <button
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", syncingAll && "animate-spin")} />
              {syncingAll ? "Sincronizando..." : "Importar conversas"}
            </button>
          )}
          {syncAllResult && (
            <span className={cn("text-xs", syncAllResult.startsWith("Erro") ? "text-error" : "text-success")}>
              {syncAllResult}
            </span>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && !isConnected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowQrModal(false); stopQrPolling(); }}>
          <div className="bg-card rounded-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-3 text-center">Conectar WhatsApp</h2>
            {qrError && (
              <div className="mb-3 px-4 py-3 rounded-lg text-sm bg-error/20 text-error">
                {qrError}
              </div>
            )}
            <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-500">
                É necessário desconectar o WhatsApp Web de outras sessões ativas antes de escanear.
              </p>
            </div>
            {qrData ? (
              <div className="text-center">
                <p className="text-sm text-white/60 mb-3">
                  Escaneie o QR Code com seu WhatsApp
                </p>
                <img
                  src={qrData}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 rounded-lg bg-white p-2 mx-auto"
                />
                <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                  <Clock className="w-4 h-4 text-white/40" />
                  <span className={qrTimer <= 10 ? "text-error" : "text-white/60"}>
                    Expira em {qrTimer}s
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-1">
                  O QR Code se renova automaticamente a cada 40 segundos.
                </p>
              </div>
            ) : qrLoading ? (
              <p className="text-center text-white/60 py-8">Gerando QR Code...</p>
            ) : qrExpired ? (
              <p className="text-center text-sm text-error py-4">
                QR Code expirado. Aguarde um novo ou feche e reconecte.
              </p>
            ) : null}
            <button
              onClick={() => { setShowQrModal(false); stopQrPolling(); }}
              className="mt-4 w-full text-sm text-white/50 hover:text-white transition-colors py-2"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Chat container */}
      <div className="flex flex-1 bg-card rounded-xl overflow-hidden min-h-0">
        {/* ── Left: Conversation List ── */}
        <div
          className={cn(
            "w-full md:w-96 md:min-w-[384px] flex flex-col border-r border-white/10",
            showChat ? "hidden md:flex" : "flex"
          )}
        >
          {/* Search + New chat */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar conversa ou contato..."
                className="w-full bg-background border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className="w-full text-sm text-accent hover:text-accent/80 transition-colors py-1"
            >
              + Nova conversa
            </button>

            {showNewChat && (
              <form onSubmit={handleNewChatSend} className="space-y-2">
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                  placeholder="+55 (11) 99999-9999"
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={2}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                />
                <button
                  type="submit"
                  disabled={sending || !newPhone || !newMessage.trim()}
                  className="w-full bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </form>
            )}
          </div>

          {/* Tabs: Conversas / Contatos */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("conversas")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
                activeTab === "conversas"
                  ? "text-accent border-b-2 border-accent"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Conversas
              {conversations.length > 0 && (
                <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                  {conversations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("contatos")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
                activeTab === "contatos"
                  ? "text-accent border-b-2 border-accent"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Contatos
              {contacts.length > 0 && (
                <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">
                  {contacts.length}
                </span>
              )}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {convsLoading && currentList.length === 0 ? (
              <div className="p-4 text-center text-white/40 text-sm">
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-white/40 text-sm">
                {searchTerm
                  ? "Nenhum resultado"
                  : activeTab === "conversas"
                  ? "Nenhuma conversa ainda"
                  : "Nenhum contato com telefone"}
              </div>
            ) : (
              filtered.map(renderConvItem)
            )}
          </div>
        </div>

        {/* ── Right: Chat Panel ── */}
        <div
          className={cn(
            "flex-1 flex flex-col",
            !showChat ? "hidden md:flex" : "flex"
          )}
        >
          {!activeLeadId ? (
            <div className="flex-1 flex items-center justify-center text-white/30">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Selecione uma conversa</p>
                <p className="text-sm mt-1">ou inicie uma nova conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <button
                  onClick={closeChat}
                  className="md:hidden text-white/60 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {activeLead ? formatContactDisplay(activeLead.name, activeLead.phone).displayName : "Carregando..."}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeLead?.stage && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", STAGE_COLORS[activeLead.stage])}>
                        {STAGE_LABELS[activeLead.stage] || activeLead.stage}
                      </span>
                    )}
                    {!isConnected && (
                      <span className="text-xs text-yellow-400">offline</span>
                    )}
                    {syncResult && (
                      <span className={cn("text-xs", syncResult.startsWith("Erro") ? "text-error" : "text-success")}>
                        {syncResult}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing || !isConnected}
                  title={isConnected ? "Sincronizar mensagens do WhatsApp" : "Conecte o WhatsApp para sincronizar"}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-5 h-5 text-white/60", syncing && "animate-spin")} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgsLoading && messages.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-8">
                    Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-white/40 text-sm py-8">
                    Nenhuma mensagem ainda — envie a primeira!
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.fromMe ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5",
                            msg.fromMe
                              ? "bg-accent text-white rounded-br-md"
                              : "bg-white/10 text-white rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <div
                            className={cn(
                              "flex items-center gap-1 mt-1",
                              msg.fromMe ? "justify-end" : "justify-start"
                            )}
                          >
                            <Clock className="w-3 h-3 opacity-40" />
                            <span className="text-xs opacity-40">
                              {formatMessageTime(msg.timestamp)}
                            </span>
                            {msg.fromMe && (
                              <Check className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Templates */}
              <div className="px-4 pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_MESSAGES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setNewMessage(tpl.text)}
                      className="px-2.5 py-1 text-xs rounded-full bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message input */}
              <form onSubmit={handleSend} className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-accent hover:bg-accent/80 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleDeleteConversation(contextMenu.leadId)}
            className="w-full px-4 py-2 text-sm text-left text-error hover:bg-white/5 transition-colors"
          >
            Apagar conversa
          </button>
        </div>
      )}
    </div>
  );
}
