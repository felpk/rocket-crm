import { requireAuth } from "@/lib/auth";
import { fetchChats, fetchMessages } from "@/lib/evolution";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp/sync-all");

interface EvolutionChat {
  remoteJid: string;
  pushName?: string | null;
  lastMessage?: {
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    key?: { fromMe?: boolean };
    messageTimestamp?: number;
  } | null;
}

export async function POST() {
  log.info("POST /api/whatsapp/sync-all");
  try {
    const session = await requireAuth();

    const connection = await prisma.whatsappConnection.findUnique({
      where: { userId: session.id },
    });

    if (!connection || connection.status !== "connected") {
      return Response.json(
        { error: "WhatsApp não está conectado" },
        { status: 400 }
      );
    }

    // Fetch all chats from Evolution API
    const chats: EvolutionChat[] = await fetchChats(connection.instanceName);
    log.info("Chats recebidos da Evolution API", { count: chats.length });

    let importedContacts = 0;
    let importedMessages = 0;
    let skippedGroups = 0;

    for (const chat of chats) {
      const jid = chat.remoteJid;
      if (!jid) continue;

      // Skip groups and special JIDs
      if (jid.includes("@g.us") || jid === "0@s.whatsapp.net" || jid === "status@broadcast") {
        skippedGroups++;
        continue;
      }

      // Extract phone from JID (handles both @s.whatsapp.net and @lid)
      const phone = jid.replace("@s.whatsapp.net", "").replace("@lid", "");
      if (!phone || phone.length < 5) continue;

      // Only import @s.whatsapp.net contacts (real phone numbers)
      if (!jid.endsWith("@s.whatsapp.net")) {
        skippedGroups++;
        continue;
      }

      // Try to get name from chat pushName or lastMessage pushName (if not fromMe)
      const lastMsgPushName = chat.lastMessage?.key?.fromMe ? null : (chat.lastMessage as Record<string, unknown>)?.pushName as string | undefined;
      const chatName = chat.pushName || lastMsgPushName;
      const name = (chatName && chatName !== phone) ? chatName : phone;

      // Find or create lead
      let lead = await prisma.lead.findFirst({
        where: { phone, userId: session.id },
      });

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            name,
            phone,
            origin: "whatsapp",
            stage: "lead",
            userId: session.id,
          },
        });
        importedContacts++;
        log.debug("Lead criado via sync-all", { leadId: lead.id, phone, name });
      }

      // Fetch messages for this contact
      try {
        const result = await fetchMessages(connection.instanceName, phone);
        // Evolution API v2 returns paginated: { messages: { records: [...] } }
        // or older format: array or { messages: [...] }
        let rawMessages: Array<Record<string, unknown>> = [];
        if (Array.isArray(result)) {
          rawMessages = result;
        } else if (result?.messages?.records && Array.isArray(result.messages.records)) {
          rawMessages = result.messages.records;
        } else if (Array.isArray(result?.messages)) {
          rawMessages = result.messages;
        } else if (Array.isArray(result?.data)) {
          rawMessages = result.data;
        }

        // Extract pushName from incoming messages (the contact's WhatsApp profile name)
        let contactName: string | null = null;
        for (const msg of rawMessages) {
          const msgPushName = msg.pushName as string | undefined;
          const key = msg.key as Record<string, unknown> | undefined;
          if (msgPushName && key?.fromMe !== true && msgPushName !== phone) {
            contactName = msgPushName;
            break;
          }
        }

        // Update lead name if we found a real pushName
        if (contactName && lead.name === phone) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { name: contactName },
          });
          lead = { ...lead, name: contactName };
          log.debug("Lead nome atualizado via pushName", { leadId: lead.id, name: contactName });
        }

        for (const msg of rawMessages) {
          const key = msg.key as Record<string, unknown> | undefined;
          const fromMe = key?.fromMe === true;
          const content =
            (msg.message as Record<string, unknown>)?.conversation as string ??
            ((msg.message as Record<string, unknown>)?.extendedTextMessage as Record<string, unknown>)?.text as string ??
            null;

          if (!content) continue;

          const messageTimestamp = msg.messageTimestamp as number | string | undefined;
          const timestamp = messageTimestamp
            ? new Date(Number(messageTimestamp) * (Number(messageTimestamp) > 1e12 ? 1 : 1000))
            : new Date();

          // Dedup: check if message with same content and close timestamp exists
          const windowStart = new Date(timestamp.getTime() - 2000);
          const windowEnd = new Date(timestamp.getTime() + 2000);

          const existing = await prisma.message.findFirst({
            where: {
              leadId: lead.id,
              content,
              fromMe,
              timestamp: { gte: windowStart, lte: windowEnd },
            },
          });

          if (!existing) {
            await prisma.message.create({
              data: { content, fromMe, timestamp, leadId: lead.id },
            });
            importedMessages++;
          }
        }

        // Update lastMessageAt
        const lastMsg = await prisma.message.findFirst({
          where: { leadId: lead.id },
          orderBy: { timestamp: "desc" },
        });
        if (lastMsg) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { lastMessageAt: lastMsg.timestamp },
          });
        }
      } catch (err) {
        log.warn("Falha ao buscar mensagens de contato", { phone, error: String(err) });
      }
    }

    log.info("Sync-all concluído", { importedContacts, importedMessages, skippedGroups });
    return Response.json({ importedContacts, importedMessages, skippedGroups, totalChats: chats.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return Response.json({ error: "Forbidden" }, { status: 403 });
    log.error("Falha no sync-all", { error: msg });
    return Response.json(
      { error: "Falha ao sincronizar conversas", details: msg },
      { status: 500 }
    );
  }
}
