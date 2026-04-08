import { createLogger } from "./logger";

const log = createLogger("evolution-api");

const API_URL = process.env.EVOLUTION_API_URL!;
const API_KEY = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

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

export async function getConnectionState() {
  log.info("Verificando estado da conexão", { instance: INSTANCE });
  return evoFetch(`/instance/connectionState/${INSTANCE}`);
}

export async function getQrCode() {
  log.info("Gerando QR Code", { instance: INSTANCE });
  return evoFetch(`/instance/connect/${INSTANCE}`);
}

export async function sendTextMessage(phone: string, text: string) {
  log.info("Enviando mensagem", { instance: INSTANCE, phone, textLength: text.length });
  return evoFetch(`/message/sendText/${INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({ number: phone, text }),
  });
}

export async function fetchMessages(phone: string) {
  log.info("Buscando mensagens", { instance: INSTANCE, phone });
  return evoFetch(`/chat/findMessages/${INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      where: {
        key: { remoteJid: `${phone}@s.whatsapp.net` },
      },
      limit: 50,
    }),
  });
}

export { INSTANCE };
