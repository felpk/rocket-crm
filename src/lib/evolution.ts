import { createLogger } from "./logger";

const log = createLogger("evolution-api");

const API_URL = process.env.EVOLUTION_API_URL!;
const API_KEY = process.env.EVOLUTION_API_KEY!;

async function evoFetch(path: string, options?: RequestInit) {
  const url = `${API_URL}${path}`;
  log.debug("evoFetch", { method: options?.method || "GET", path });
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    log.error("Evolution API erro", { status: res.status, path, response: text });
    throw new Error(`Evolution API error: ${res.status} - ${text}`);
  }
  log.debug("evoFetch OK", { status: res.status, path });
  return res.json();
}

export async function createInstance(instanceName: string, webhookUrl?: string) {
  log.info("Criando instância", { instanceName });
  const body: Record<string, unknown> = {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  };

  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      webhook_by_events: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    };
  }

  return evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteInstance(instanceName: string) {
  log.info("Deletando instância", { instanceName });
  return evoFetch(`/instance/delete/${instanceName}`, {
    method: "DELETE",
  });
}

export async function getConnectionState(instanceName: string) {
  log.info("Verificando estado da conexão", { instance: instanceName });
  return evoFetch(`/instance/connectionState/${instanceName}`);
}

export async function getQrCode(instanceName: string) {
  log.info("Gerando QR Code", { instance: instanceName });
  return evoFetch(`/instance/connect/${instanceName}`);
}

export async function sendTextMessage(instanceName: string, phone: string, text: string) {
  log.info("Enviando mensagem", { instance: instanceName, phone, textLength: text.length });
  return evoFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: phone, text }),
  });
}

export async function fetchMessages(instanceName: string, phone: string) {
  log.info("Buscando mensagens", { instance: instanceName, phone });
  return evoFetch(`/chat/findMessages/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      where: {
        key: { remoteJid: `${phone}@s.whatsapp.net` },
      },
      limit: 50,
    }),
  });
}

export async function setWebhook(instanceName: string, webhookUrl: string) {
  log.info("Configurando webhook", { instance: instanceName, webhookUrl });
  return evoFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    }),
  });
}

export async function fetchInstances() {
  log.info("Listando instâncias");
  return evoFetch("/instance/fetchInstances");
}
