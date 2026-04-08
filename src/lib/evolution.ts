const API_URL = process.env.EVOLUTION_API_URL!;
const API_KEY = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

async function evoFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API error: ${res.status} - ${text}`);
  }
  return res.json();
}

export async function getConnectionState() {
  return evoFetch(`/instance/connectionState/${INSTANCE}`);
}

export async function getQrCode() {
  return evoFetch(`/instance/connect/${INSTANCE}`);
}

export async function sendTextMessage(phone: string, text: string) {
  return evoFetch(`/message/sendText/${INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      number: phone,
      text,
    }),
  });
}

export async function fetchMessages(phone: string) {
  return evoFetch(`/chat/findMessages/${INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      where: {
        key: {
          remoteJid: `${phone}@s.whatsapp.net`,
        },
      },
      limit: 50,
    }),
  });
}

export { INSTANCE };
