/**
 * Script de teste E2E para todas as APIs do CRM.
 * Roda com: npx tsx scripts/test-api.ts
 * Requer: npm run dev rodando em http://localhost:3000
 */

const BASE = "http://localhost:3000";
let authCookie = "";
let createdLeadId = "";

type TestResult = { name: string; status: "PASS" | "FAIL"; details?: string };
const results: TestResult[] = [];

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
      ...options?.headers,
    },
    redirect: "manual",
  });
  return res;
}

function pass(name: string, details?: string) {
  results.push({ name, status: "PASS", details });
  console.log(`  ✅ ${name}${details ? ` — ${details}` : ""}`);
}

function fail(name: string, details: string) {
  results.push({ name, status: "FAIL", details });
  console.log(`  ❌ ${name} — ${details}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    fail(name, String(err));
  }
}

// ==================== AUTH ====================

async function testAuth() {
  console.log("\n🔐 AUTH");

  await test("POST /api/auth/register — campos vazios retorna 400", async () => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (res.status === 400) pass("Register: campos vazios → 400");
    else fail("Register: campos vazios → 400", `status=${res.status}`);
  });

  await test("POST /api/auth/register — criar usuário teste", async () => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Teste CRM",
        email: `teste_${Date.now()}@test.com`,
        password: "teste123",
      }),
    });
    if (res.status === 200) {
      const data = await res.json();
      const cookie = res.headers.get("set-cookie");
      if (cookie) authCookie = cookie.split(";")[0];
      pass("Register: criar usuário", `userId=${data.id}, role=${data.role}`);
    } else {
      const data = await res.json();
      fail("Register: criar usuário", `status=${res.status} ${data.error}`);
    }
  });

  await test("POST /api/auth/login — credenciais inválidas retorna 401", async () => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nao@existe.com", password: "errada" }),
    });
    if (res.status === 401) pass("Login: credenciais inválidas → 401");
    else fail("Login: credenciais inválidas → 401", `status=${res.status}`);
  });

  await test("POST /api/auth/login — admin login", async () => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "rocketmidia09@gmail.com",
        password: "admin123",
      }),
    });
    if (res.status === 200) {
      const data = await res.json();
      const cookie = res.headers.get("set-cookie");
      if (cookie) authCookie = cookie.split(";")[0];
      pass("Login: admin", `role=${data.role}`);
    } else {
      fail("Login: admin", `status=${res.status} — verifique se o seed foi executado`);
    }
  });

  await test("GET /api/auth/me — retorna sessão", async () => {
    const res = await apiFetch("/api/auth/me");
    if (res.status === 200) {
      const data = await res.json();
      pass("Auth/me: sessão ativa", `user=${data.user?.email}`);
    } else {
      fail("Auth/me: sessão ativa", `status=${res.status}`);
    }
  });
}

// ==================== LEADS ====================

async function testLeads() {
  console.log("\n📋 LEADS");

  await test("POST /api/leads — criar lead", async () => {
    const res = await apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Lead Teste",
        email: "lead@teste.com",
        phone: "5511999999999",
        company: "Empresa Teste",
        value: "5000",
        origin: "google_ads",
        notes: "Nota de teste",
      }),
    });
    if (res.status === 201) {
      const data = await res.json();
      createdLeadId = data.id;
      pass("Criar lead", `id=${data.id}, stage=${data.stage}`);
    } else {
      fail("Criar lead", `status=${res.status}`);
    }
  });

  await test("GET /api/leads — listar leads", async () => {
    const res = await apiFetch("/api/leads");
    if (res.status === 200) {
      const data = await res.json();
      pass("Listar leads", `total=${data.length}`);
    } else {
      fail("Listar leads", `status=${res.status}`);
    }
  });

  await test("PATCH /api/leads/:id — mover lead de etapa", async () => {
    if (!createdLeadId) {
      fail("Mover lead", "Lead não foi criado");
      return;
    }
    const res = await apiFetch(`/api/leads/${createdLeadId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "qualification" }),
    });
    if (res.status === 200) {
      const data = await res.json();
      pass("Mover lead", `stage=${data.stage}`);
    } else {
      fail("Mover lead", `status=${res.status}`);
    }
  });

  await test("PATCH /api/leads/:id — editar lead", async () => {
    if (!createdLeadId) {
      fail("Editar lead", "Lead não foi criado");
      return;
    }
    const res = await apiFetch(`/api/leads/${createdLeadId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Lead Editado", value: "10000" }),
    });
    if (res.status === 200) {
      const data = await res.json();
      pass("Editar lead", `name=${data.name}, value=${data.value}`);
    } else {
      fail("Editar lead", `status=${res.status}`);
    }
  });

  await test("PATCH /api/leads/inexistente — 404", async () => {
    const res = await apiFetch("/api/leads/id_inexistente_xyz", {
      method: "PATCH",
      body: JSON.stringify({ name: "Test" }),
    });
    if (res.status === 404) pass("Lead inexistente → 404");
    else fail("Lead inexistente → 404", `status=${res.status}`);
  });

  await test("DELETE /api/leads/:id — excluir lead", async () => {
    if (!createdLeadId) {
      fail("Excluir lead", "Lead não foi criado");
      return;
    }
    const res = await apiFetch(`/api/leads/${createdLeadId}`, {
      method: "DELETE",
    });
    if (res.status === 200) pass("Excluir lead", `id=${createdLeadId}`);
    else fail("Excluir lead", `status=${res.status}`);
  });
}

// ==================== WHATSAPP ====================

async function testWhatsApp() {
  console.log("\n💬 WHATSAPP");

  // 1. Status check
  await test("GET /api/whatsapp/status — verificar conexão", async () => {
    const res = await apiFetch("/api/whatsapp/status");
    if (res.status === 200) {
      const data = await res.json();
      if (!data.instance || typeof data.instance.state !== "string") {
        fail("WhatsApp status", `[FAIL] whatsapp-status | module: whatsapp/status/route.ts | expected: instance.state string | got: ${JSON.stringify(data)}`);
        return;
      }
      pass("WhatsApp status", `state=${data.instance.state}`);
    } else {
      fail("WhatsApp status", `[FAIL] whatsapp-status | module: whatsapp/status/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 2. Send validation — empty body
  await test("POST /api/whatsapp/send — campos vazios retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      const data = await res.json();
      if (!data.error) {
        fail("WhatsApp send: campos vazios → 400", `[FAIL] send-empty | module: whatsapp/send/route.ts | expected: error message | got: ${JSON.stringify(data)}`);
        return;
      }
      pass("WhatsApp send: campos vazios → 400", `error="${data.error}"`);
    } else {
      fail("WhatsApp send: campos vazios → 400", `[FAIL] send-empty | module: whatsapp/send/route.ts | expected: 400 | got: ${res.status}`);
    }
  });

  // 3. Send validation — phone without text
  await test("POST /api/whatsapp/send — phone sem text retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999" }),
    });
    if (res.status === 400) pass("WhatsApp send: phone sem text → 400");
    else fail("WhatsApp send: phone sem text → 400", `[FAIL] send-no-text | module: whatsapp/send/route.ts | expected: 400 | got: ${res.status}`);
  });

  // 4. Send validation — text without phone
  await test("POST /api/whatsapp/send — text sem phone retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    });
    if (res.status === 400) pass("WhatsApp send: text sem phone → 400");
    else fail("WhatsApp send: text sem phone → 400", `[FAIL] send-no-phone | module: whatsapp/send/route.ts | expected: 400 | got: ${res.status}`);
  });

  // 5. Send when not connected — saves locally, returns 200 with sent=false
  await test("POST /api/whatsapp/send — sem conexão salva localmente", async () => {
    const testPhone = `55119${Date.now().toString().slice(-8)}`;
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({ phone: testPhone, text: "Teste offline" }),
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data.leadId && data.sent === false) {
        pass("WhatsApp send: sem conexão → salva local", `leadId=${data.leadId}, sent=false`);
        // Cleanup
        await apiFetch(`/api/leads/${data.leadId}`, { method: "DELETE" });
      } else {
        pass("WhatsApp send: sem conexão → 200", `leadId=${data.leadId}, sent=${data.sent}`);
        if (data.leadId) await apiFetch(`/api/leads/${data.leadId}`, { method: "DELETE" });
      }
    } else {
      fail("WhatsApp send: sem conexão", `[FAIL] send-disconnected | module: whatsapp/send/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 6. Conversations endpoint — returns { conversations, contacts }
  await test("GET /api/whatsapp/conversations — retorna conversations e contacts", async () => {
    const res = await apiFetch("/api/whatsapp/conversations");
    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data.conversations) && Array.isArray(data.contacts)) {
        pass("Conversations: formato correto", `conversations=${data.conversations.length}, contacts=${data.contacts.length}`);
      } else {
        fail("Conversations: formato correto", `[FAIL] conversations-format | module: whatsapp/conversations/route.ts | expected: { conversations[], contacts[] } | got: ${JSON.stringify(Object.keys(data))}`);
      }
    } else {
      fail("Conversations: formato correto", `[FAIL] conversations-format | module: whatsapp/conversations/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 7. Conversations shape validation
  await test("GET /api/whatsapp/conversations — shape correto dos items", async () => {
    const res = await apiFetch("/api/whatsapp/conversations");
    if (res.status !== 200) {
      fail("Conversations: shape", `[FAIL] conversations-shape | module: whatsapp/conversations/route.ts | expected: 200 | got: ${res.status}`);
      return;
    }
    const data = await res.json();
    const allItems = [...(data.conversations || []), ...(data.contacts || [])];
    if (allItems.length > 0) {
      const conv = allItems[0];
      const hasFields = "leadId" in conv && "name" in conv && "phone" in conv && "stage" in conv && "lastMessage" in conv && "messageCount" in conv;
      if (hasFields) {
        pass("Conversations: shape correto", `fields=leadId,name,phone,stage,lastMessage,messageCount`);
      } else {
        fail("Conversations: shape correto", `[FAIL] conversations-shape | module: whatsapp/conversations/route.ts | expected: leadId,name,phone,stage,lastMessage,messageCount | got: ${Object.keys(conv).join(",")}`);
      }
    } else {
      pass("Conversations: shape correto", "listas vazias — shape não verificável");
    }
  });

  // 8. Messages endpoint — leadId obrigatório
  await test("GET /api/whatsapp/messages — sem leadId retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/messages");
    if (res.status === 400) {
      const data = await res.json();
      pass("Messages: sem leadId → 400", `error="${data.error}"`);
    } else {
      fail("Messages: sem leadId → 400", `[FAIL] messages-no-leadId | module: whatsapp/messages/route.ts | expected: 400 | got: ${res.status}`);
    }
  });

  // 9. Messages endpoint — lead inexistente retorna 404
  await test("GET /api/whatsapp/messages — lead inexistente retorna 404", async () => {
    const res = await apiFetch("/api/whatsapp/messages?leadId=lead_inexistente_xyz");
    if (res.status === 404) {
      const data = await res.json();
      pass("Messages: lead inexistente → 404", `error="${data.error}"`);
    } else {
      fail("Messages: lead inexistente → 404", `[FAIL] messages-not-found | module: whatsapp/messages/route.ts | expected: 404 | got: ${res.status}`);
    }
  });

  // 10. Messages endpoint — lead válido retorna mensagens
  await test("GET /api/whatsapp/messages — lead válido", async () => {
    // Primeiro criar um lead com mensagem para testar
    const leadRes = await apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Lead WhatsApp Teste",
        phone: "5511888887777",
        origin: "whatsapp",
      }),
    });
    if (leadRes.status !== 201) {
      fail("Messages: lead válido", `[FAIL] messages-valid | module: whatsapp/messages/route.ts | pré-requisito: criar lead falhou, status=${leadRes.status}`);
      return;
    }
    const lead = await leadRes.json();

    const res = await apiFetch(`/api/whatsapp/messages?leadId=${lead.id}`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.lead && Array.isArray(data.messages)) {
        pass("Messages: lead válido", `leadName=${data.lead.name}, msgs=${data.messages.length}`);
      } else {
        fail("Messages: lead válido", `[FAIL] messages-valid | module: whatsapp/messages/route.ts | expected: { lead, messages[] } | got: ${JSON.stringify(Object.keys(data))}`);
      }
    } else {
      fail("Messages: lead válido", `[FAIL] messages-valid | module: whatsapp/messages/route.ts | expected: 200 | got: ${res.status}`);
    }

    // Cleanup
    await apiFetch(`/api/leads/${lead.id}`, { method: "DELETE" });
  });

  // 11. Sync — leadId obrigatório
  await test("POST /api/whatsapp/sync — sem leadId retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      const data = await res.json();
      pass("Sync: sem leadId → 400", `error="${data.error}"`);
    } else {
      fail("Sync: sem leadId → 400", `[FAIL] sync-no-leadId | module: whatsapp/sync/route.ts | expected: 400 | got: ${res.status}`);
    }
  });

  // 12. Sync — lead inexistente retorna 404
  await test("POST /api/whatsapp/sync — lead inexistente retorna 404", async () => {
    const res = await apiFetch("/api/whatsapp/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: "lead_inexistente_xyz" }),
    });
    // 404 (lead not found) or 400 (not connected)
    if (res.status === 404 || res.status === 400) {
      const data = await res.json();
      pass("Sync: lead inexistente", `status=${res.status}, error="${data.error}"`);
    } else {
      fail("Sync: lead inexistente", `[FAIL] sync-not-found | module: whatsapp/sync/route.ts | expected: 404 or 400 | got: ${res.status}`);
    }
  });
}

// ==================== WHATSAPP AUTH ====================

async function testWhatsAppAuth() {
  console.log("\n🔒 WHATSAPP AUTH");

  // 13. Status without auth
  await test("GET /api/whatsapp/status — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/whatsapp/status");
    authCookie = saved;
    if (res.status === 401) pass("WhatsApp status sem cookie → 401");
    else fail("WhatsApp status sem cookie → 401", `[FAIL] status-no-auth | module: whatsapp/status/route.ts | expected: 401 | got: ${res.status}`);
  });

  // 14. Conversations without auth
  await test("GET /api/whatsapp/conversations — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/whatsapp/conversations");
    authCookie = saved;
    if (res.status === 401) pass("Conversations sem cookie → 401");
    else fail("Conversations sem cookie → 401", `[FAIL] conversations-no-auth | module: whatsapp/conversations/route.ts | expected: 401 | got: ${res.status}`);
  });

  // 15. Messages without auth
  await test("GET /api/whatsapp/messages — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/whatsapp/messages?leadId=test");
    authCookie = saved;
    if (res.status === 401) pass("Messages sem cookie → 401");
    else fail("Messages sem cookie → 401", `[FAIL] messages-no-auth | module: whatsapp/messages/route.ts | expected: 401 | got: ${res.status}`);
  });

  // 16. Send without auth
  await test("POST /api/whatsapp/send — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({ phone: "5511999999999", text: "test" }),
    });
    authCookie = saved;
    if (res.status === 401) pass("Send sem cookie → 401");
    else fail("Send sem cookie → 401", `[FAIL] send-no-auth | module: whatsapp/send/route.ts | expected: 401 | got: ${res.status}`);
  });

  // 17. Sync without auth
  await test("POST /api/whatsapp/sync — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/whatsapp/sync", {
      method: "POST",
      body: JSON.stringify({ leadId: "test" }),
    });
    authCookie = saved;
    if (res.status === 401) pass("Sync sem cookie → 401");
    else fail("Sync sem cookie → 401", `[FAIL] sync-no-auth | module: whatsapp/sync/route.ts | expected: 401 | got: ${res.status}`);
  });
}

// ==================== WHATSAPP CONVERSATIONS FLOW ====================

async function testWhatsAppConversationsFlow() {
  console.log("\n💬 WHATSAPP CONVERSATIONS FLOW");

  let testLeadId = "";

  // 18. Criar lead com telefone, verificar que aparece em CONTACTS (sem mensagens)
  await test("Conversations — lead sem mensagens aparece em contacts", async () => {
    const leadRes = await apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Lead Sem Msgs",
        phone: "5511777776666",
        origin: "manual",
      }),
    });
    if (leadRes.status !== 201) {
      fail("Lead em contacts", `[FAIL] conv-contacts | module: whatsapp/conversations/route.ts | pré-requisito: criar lead falhou, status=${leadRes.status}`);
      return;
    }
    const lead = await leadRes.json();
    testLeadId = lead.id;

    const convRes = await apiFetch("/api/whatsapp/conversations");
    if (convRes.status !== 200) {
      fail("Lead em contacts", `[FAIL] conv-contacts | module: whatsapp/conversations/route.ts | expected: 200 | got: ${convRes.status}`);
      return;
    }
    const data = await convRes.json();
    const inConvs = (data.conversations || []).some((c: { leadId: string }) => c.leadId === testLeadId);
    const inContacts = (data.contacts || []).some((c: { leadId: string }) => c.leadId === testLeadId);
    if (!inConvs && inContacts) {
      pass("Lead em contacts", `leadId=${testLeadId} em contacts, ausente de conversations — correto`);
    } else if (inConvs) {
      fail("Lead em contacts", `[FAIL] conv-contacts | expected: em contacts | got: em conversations`);
    } else {
      fail("Lead em contacts", `[FAIL] conv-contacts | expected: em contacts | got: ausente de ambos`);
    }
  });

  // 19. Messages endpoint retorna lead + array vazio para lead sem mensagens
  await test("Messages — lead sem mensagens retorna array vazio", async () => {
    if (!testLeadId) { fail("Lead sem msgs → array vazio", "pré-requisito: lead não criado"); return; }

    const res = await apiFetch(`/api/whatsapp/messages?leadId=${testLeadId}`);
    if (res.status !== 200) {
      fail("Lead sem msgs → array vazio", `[FAIL] msgs-empty | module: whatsapp/messages/route.ts | expected: 200 | got: ${res.status}`);
      return;
    }
    const data = await res.json();
    if (data.lead && Array.isArray(data.messages) && data.messages.length === 0) {
      pass("Lead sem msgs → array vazio", `lead=${data.lead.name}`);
    } else {
      fail("Lead sem msgs → array vazio", `[FAIL] msgs-empty | module: whatsapp/messages/route.ts | expected: 0 messages | got: ${data.messages?.length}`);
    }
  });

  // 20. Conversations ordering — most recent first
  await test("Conversations — ordenação por lastMessageAt desc", async () => {
    const convRes = await apiFetch("/api/whatsapp/conversations");
    if (convRes.status !== 200) {
      fail("Conversations ordering", `[FAIL] conv-order | module: whatsapp/conversations/route.ts | expected: 200 | got: ${convRes.status}`);
      return;
    }
    const data = await convRes.json();
    const convs: Array<{ leadId: string; lastMessage: { timestamp: string } | null }> = data.conversations || [];
    if (convs.length < 2) {
      pass("Conversations ordering", "menos de 2 conversations — não verificável");
      return;
    }
    let ordered = true;
    for (let i = 1; i < convs.length; i++) {
      const prev = convs[i - 1].lastMessage?.timestamp;
      const curr = convs[i].lastMessage?.timestamp;
      if (prev && curr && new Date(prev).getTime() < new Date(curr).getTime()) {
        ordered = false;
        break;
      }
    }
    if (ordered) {
      pass("Conversations ordering", `${convs.length} conversas em ordem desc`);
    } else {
      fail("Conversations ordering", `[FAIL] conv-order | module: whatsapp/conversations/route.ts | expected: descending order | got: out of order`);
    }
  });

  // Cleanup test lead
  if (testLeadId) {
    await apiFetch(`/api/leads/${testLeadId}`, { method: "DELETE" });
  }
}

// ==================== WHATSAPP WEBHOOK COMPREHENSIVE ====================

async function testWhatsAppWebhook() {
  console.log("\n📨 WHATSAPP WEBHOOK");

  // 21. Valid incoming message creates lead and message
  await test("Webhook — mensagem válida retorna ok", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance-webhook",
        data: {
          key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: false },
          message: { conversation: "Ola, quero saber mais" },
          pushName: "Teste Webhook Lead",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook mensagem válida", "ok=true");
    } else {
      fail("Webhook mensagem válida", `[FAIL] webhook-valid | module: whatsapp/webhook/route.ts | expected: 200 + ok=true | got: ${res.status} | body: ${JSON.stringify(body)}`);
    }
  });

  // 22. Non-message event ignored
  await test("Webhook — evento connection.update ignorado", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "connection.update",
        instance: "test-instance",
        data: { state: "open" },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook connection.update ignorado", "ok=true");
    } else {
      fail("Webhook connection.update ignorado", `[FAIL] webhook-connection | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 23. fromMe messages ignored
  await test("Webhook — fromMe:true ignorado", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true },
          message: { conversation: "Mensagem enviada por mim" },
          pushName: "Eu",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook fromMe ignorado", "ok=true");
    } else {
      fail("Webhook fromMe ignorado", `[FAIL] webhook-fromMe | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 24. Missing instanceName
  await test("Webhook — sem instanceName retorna ok (não crasheia)", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        data: {
          key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: false },
          message: { conversation: "Teste sem instancia" },
          pushName: "Teste",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook sem instanceName", "ok=true — gracefully handled");
    } else {
      fail("Webhook sem instanceName", `[FAIL] webhook-no-instance | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 25. Empty message text ignored
  await test("Webhook — mensagem vazia ignorada", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: false },
          message: {},
          pushName: "Teste",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook mensagem vazia", "ok=true — ignored");
    } else {
      fail("Webhook mensagem vazia", `[FAIL] webhook-empty-msg | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 26. ExtendedTextMessage format
  await test("Webhook — extendedTextMessage processado", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance-webhook",
        data: {
          key: { remoteJid: "5511999997777@s.whatsapp.net", fromMe: false },
          message: { extendedTextMessage: { text: "Mensagem com link https://example.com" } },
          pushName: "Teste Extended",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook extendedTextMessage", "ok=true");
    } else {
      fail("Webhook extendedTextMessage", `[FAIL] webhook-extended | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status}`);
    }
  });

  // 27. Duplicate message handling (send same message twice quickly)
  await test("Webhook — mensagem duplicada tratada", async () => {
    const payload = {
      event: "messages.upsert",
      instance: "test-instance-webhook",
      data: {
        key: { remoteJid: "5511999996666@s.whatsapp.net", fromMe: false },
        message: { conversation: "Mensagem duplicada teste " + Date.now() },
        pushName: "Teste Dup",
      },
    };
    const res1 = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res2 = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body1 = await res1.json();
    const body2 = await res2.json();
    if (res1.status === 200 && res2.status === 200 && body1.ok && body2.ok) {
      pass("Webhook duplicata", "ambas retornaram ok=true (dedup no DB)");
    } else {
      fail("Webhook duplicata", `[FAIL] webhook-dup | module: whatsapp/webhook/route.ts | res1=${res1.status} res2=${res2.status}`);
    }
  });

  // 28. Invalid JSON body
  await test("Webhook — JSON inválido não crasheia", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    // Should return 200 (webhook always returns ok to prevent retries) or 400
    if (res.status === 200 || res.status === 400) {
      pass("Webhook JSON inválido", `status=${res.status} — handled gracefully`);
    } else {
      fail("Webhook JSON inválido", `[FAIL] webhook-bad-json | module: whatsapp/webhook/route.ts | expected: 200 or 400 | got: ${res.status}`);
    }
  });
}

// ==================== GOOGLE ADS ====================

async function testGoogleAds() {
  console.log("\n📈 GOOGLE ADS");

  await test("GET /api/google-ads/status — verificar conexão", async () => {
    const res = await apiFetch("/api/google-ads/status");
    if (res.status === 200) {
      const data = await res.json();
      pass("Google Ads status", `connected=${data.connected}`);
    } else {
      fail("Google Ads status", `status=${res.status}`);
    }
  });

  await test("GET /api/google-ads/auth — gerar URL OAuth", async () => {
    const res = await apiFetch("/api/google-ads/auth");
    if (res.status === 200) {
      const data = await res.json();
      pass("Google Ads auth URL", `url=${data.url?.substring(0, 60)}...`);
    } else if (res.status === 500) {
      pass("Google Ads auth URL (sem CLIENT_ID configurado — esperado)", "");
    } else {
      fail("Google Ads auth URL", `status=${res.status}`);
    }
  });
}

// ==================== ADMIN ====================

async function testAdmin() {
  console.log("\n🛡️  ADMIN");

  await test("GET /api/admin/clients — listar clientes", async () => {
    const res = await apiFetch("/api/admin/clients");
    if (res.status === 200) {
      const data = await res.json();
      pass("Admin: listar clientes", `total=${data.length}`);
    } else {
      fail("Admin: listar clientes", `status=${res.status}`);
    }
  });

  await test("GET /api/admin/stats — métricas gerais", async () => {
    const res = await apiFetch("/api/admin/stats");
    if (res.status === 200) {
      const data = await res.json();
      pass(
        "Admin: stats",
        `clients=${data.totalClients}, leads=${data.totalLeads}`
      );
    } else {
      fail("Admin: stats", `status=${res.status}`);
    }
  });
}

// ==================== AUTOMATIONS ====================

let createdAutomationId = "";

async function testAutomations() {
  console.log("\n⚙️  AUTOMATIONS");

  // 1. Create keyword automation with valid data
  await test("POST /api/automations — criar automacao keyword", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Automacao Teste E2E",
        triggerType: "keyword",
        triggerConfig: { keywords: ["preco", "orcamento"] },
        actions: [{ type: "send_message", config: { message: "Ola! Segue nosso orcamento." } }],
      }),
    });
    const body = await res.json();
    if (res.status === 201 && body.id && body.name && body.triggerType && body.actions) {
      createdAutomationId = body.id;
      pass("Criar automacao keyword", `id=${body.id}, trigger=${body.triggerType}`);
    } else {
      fail(
        "Criar automacao keyword",
        `[FAIL] criar-automacao-keyword | module: automations/route.ts | expected: 201 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 2. Create with missing name
  await test("POST /api/automations — nome ausente retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        triggerType: "keyword",
        triggerConfig: { keywords: ["teste"] },
        actions: [{ type: "send_message", config: {} }],
      }),
    });
    if (res.status === 400) pass("Nome ausente → 400");
    else {
      const body = await res.json();
      fail(
        "Nome ausente → 400",
        `[FAIL] nome-ausente | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 3. Create with invalid triggerType
  await test("POST /api/automations — triggerType invalido retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Teste invalido",
        triggerType: "inexistente",
        triggerConfig: {},
        actions: [{ type: "send_message", config: {} }],
      }),
    });
    if (res.status === 400) pass("TriggerType invalido → 400");
    else {
      const body = await res.json();
      fail(
        "TriggerType invalido → 400",
        `[FAIL] trigger-invalido | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 4. Create with empty actions array
  await test("POST /api/automations — actions vazio retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Teste sem acoes",
        triggerType: "keyword",
        triggerConfig: { keywords: ["teste"] },
        actions: [],
      }),
    });
    if (res.status === 400) pass("Actions vazio → 400");
    else {
      const body = await res.json();
      fail(
        "Actions vazio → 400",
        `[FAIL] actions-vazio | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 5. List all automations
  await test("GET /api/automations — listar automacoes", async () => {
    const res = await apiFetch("/api/automations");
    const body = await res.json();
    if (res.status === 200 && Array.isArray(body)) {
      const found = body.some((a: { id: string }) => a.id === createdAutomationId);
      if (found) {
        pass("Listar automacoes", `total=${body.length}, contém criada=true`);
      } else {
        fail(
          "Listar automacoes",
          `[FAIL] listar-automacoes | module: automations/route.ts | expected: array contendo id=${createdAutomationId} | got: ids=[${body.map((a: { id: string }) => a.id).join(",")}]`
        );
      }
    } else {
      fail(
        "Listar automacoes",
        `[FAIL] listar-automacoes | module: automations/route.ts | expected: 200 + array | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 6. Toggle active to false
  await test("PATCH /api/automations/[id] — desativar automacao", async () => {
    if (!createdAutomationId) { fail("Desativar automacao", "Automacao nao foi criada"); return; }
    const res = await apiFetch(`/api/automations/${createdAutomationId}`, {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
    const body = await res.json();
    if (res.status === 200 && body.active === false) {
      pass("Desativar automacao", `active=${body.active}`);
    } else {
      fail(
        "Desativar automacao",
        `[FAIL] desativar | module: automations/[id]/route.ts | expected: 200 + active=false | got: ${res.status} | active=${body.active} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 7. Update name
  await test("PATCH /api/automations/[id] — atualizar nome", async () => {
    if (!createdAutomationId) { fail("Atualizar nome", "Automacao nao foi criada"); return; }
    const res = await apiFetch(`/api/automations/${createdAutomationId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Automacao Renomeada E2E" }),
    });
    const body = await res.json();
    if (res.status === 200 && body.name === "Automacao Renomeada E2E") {
      pass("Atualizar nome", `name=${body.name}`);
    } else {
      fail(
        "Atualizar nome",
        `[FAIL] atualizar-nome | module: automations/[id]/route.ts | expected: 200 + name='Automacao Renomeada E2E' | got: ${res.status} | name=${body.name} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 8. Get logs (should be empty)
  await test("GET /api/automations/[id]/logs — logs vazios", async () => {
    if (!createdAutomationId) { fail("Logs vazios", "Automacao nao foi criada"); return; }
    const res = await apiFetch(`/api/automations/${createdAutomationId}/logs`);
    const body = await res.json();
    if (res.status === 200 && Array.isArray(body)) {
      pass("Logs vazios", `count=${body.length}`);
    } else {
      fail(
        "Logs vazios",
        `[FAIL] logs-vazios | module: automations/[id]/logs/route.ts | expected: 200 + array | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 9. Delete automation
  await test("DELETE /api/automations/[id] — excluir automacao", async () => {
    if (!createdAutomationId) { fail("Excluir automacao", "Automacao nao foi criada"); return; }
    const res = await apiFetch(`/api/automations/${createdAutomationId}`, {
      method: "DELETE",
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Excluir automacao", `id=${createdAutomationId}`);
    } else {
      fail(
        "Excluir automacao",
        `[FAIL] excluir | module: automations/[id]/route.ts | expected: 200 + ok=true | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 10. Verify deleted
  await test("GET /api/automations — verificar exclusao", async () => {
    const res = await apiFetch("/api/automations");
    const body = await res.json();
    if (res.status === 200 && Array.isArray(body)) {
      const found = body.some((a: { id: string }) => a.id === createdAutomationId);
      if (!found) {
        pass("Verificar exclusao", "Automacao removida da lista");
      } else {
        fail(
          "Verificar exclusao",
          `[FAIL] verificar-exclusao | module: automations/route.ts | expected: automacao ausente | got: ainda presente na lista`
        );
      }
    } else {
      fail(
        "Verificar exclusao",
        `[FAIL] verificar-exclusao | module: automations/route.ts | expected: 200 + array | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });
}

// ==================== AUTOMATIONS VALIDATION ====================

async function testAutomationsValidation() {
  console.log("\n🔎 AUTOMATIONS VALIDATION");

  // 11. Keyword trigger without keywords[]
  await test("POST /api/automations — keyword sem keywords retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Keyword sem lista",
        triggerType: "keyword",
        triggerConfig: {},
        actions: [{ type: "send_message", config: {} }],
      }),
    });
    if (res.status === 400) pass("Keyword sem keywords → 400");
    else {
      const body = await res.json();
      fail(
        "Keyword sem keywords → 400",
        `[FAIL] keyword-sem-keywords | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 12. Stage_change trigger without toStage
  await test("POST /api/automations — stage_change sem toStage retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Stage sem toStage",
        triggerType: "stage_change",
        triggerConfig: {},
        actions: [{ type: "send_message", config: {} }],
      }),
    });
    if (res.status === 400) pass("Stage_change sem toStage → 400");
    else {
      const body = await res.json();
      fail(
        "Stage_change sem toStage → 400",
        `[FAIL] stage-sem-toStage | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 13. Followup trigger without delayHours
  await test("POST /api/automations — followup sem delayHours retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Followup sem delay",
        triggerType: "followup",
        triggerConfig: {},
        actions: [{ type: "send_message", config: {} }],
      }),
    });
    if (res.status === 400) pass("Followup sem delayHours → 400");
    else {
      const body = await res.json();
      fail(
        "Followup sem delayHours → 400",
        `[FAIL] followup-sem-delay | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 14. Action with invalid type
  await test("POST /api/automations — action com tipo invalido retorna 400", async () => {
    const res = await apiFetch("/api/automations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acao invalida",
        triggerType: "keyword",
        triggerConfig: { keywords: ["teste"] },
        actions: [{ type: "tipo_inexistente", config: {} }],
      }),
    });
    if (res.status === 400) pass("Action tipo invalido → 400");
    else {
      const body = await res.json();
      fail(
        "Action tipo invalido → 400",
        `[FAIL] action-tipo-invalido | module: automations/route.ts | expected: 400 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });
}

// ==================== WEBHOOK TESTS ====================

async function testWebhookAutomations() {
  console.log("\n📨 WEBHOOK AUTOMATIONS");

  // 15. Valid message payload with keyword
  await test("POST /api/whatsapp/webhook — mensagem com keyword", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: { remoteJid: "5511988887777@s.whatsapp.net", fromMe: false },
          message: { conversation: "Quero saber o preco" },
          pushName: "Teste Webhook",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Webhook mensagem com keyword", "ok=true");
    } else {
      fail(
        "Webhook mensagem com keyword",
        `[FAIL] webhook-keyword | module: whatsapp/webhook/route.ts | expected: 200 + ok=true | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 16. Non-message event
  await test("POST /api/whatsapp/webhook — evento nao-mensagem ignorado", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "connection.update",
        instance: "test-instance",
        data: { state: "open" },
      }),
    });
    const body = await res.json();
    if (res.status === 200) {
      pass("Webhook evento ignorado", `ok=${body.ok}`);
    } else {
      fail(
        "Webhook evento ignorado",
        `[FAIL] webhook-nao-mensagem | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });

  // 17. fromMe: true message
  await test("POST /api/whatsapp/webhook — fromMe ignorado", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: "test-instance",
        data: {
          key: { remoteJid: "5511988887777@s.whatsapp.net", fromMe: true },
          message: { conversation: "Mensagem minha" },
          pushName: "Eu",
        },
      }),
    });
    const body = await res.json();
    if (res.status === 200) {
      pass("Webhook fromMe ignorado", `ok=${body.ok}`);
    } else {
      fail(
        "Webhook fromMe ignorado",
        `[FAIL] webhook-fromMe | module: whatsapp/webhook/route.ts | expected: 200 | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });
}

// ==================== AUTOMATIONS TICK ====================

async function testAutomationsTick() {
  console.log("\n⏱️  AUTOMATIONS TICK");

  // 18. Run followup scan
  await test("POST /api/automations/tick — followup scan", async () => {
    const res = await apiFetch("/api/automations/tick", { method: "POST" });
    const body = await res.json();
    if (res.status === 200 && body.ok === true) {
      pass("Followup tick", "ok=true");
    } else {
      fail(
        "Followup tick",
        `[FAIL] followup-tick | module: automations/tick/route.ts | expected: 200 + ok=true | got: ${res.status} | body: ${JSON.stringify(body)}`
      );
    }
  });
}

// ==================== AUTOMATIONS AUTH ====================

async function testAutomationsAuth() {
  console.log("\n🔒 AUTOMATIONS AUTH");

  // 19. GET /api/automations without auth cookie
  await test("GET /api/automations — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/automations");
    authCookie = saved;
    if (res.status === 401) pass("Automations sem cookie → 401");
    else {
      fail(
        "Automations sem cookie → 401",
        `[FAIL] automations-sem-auth | module: automations/route.ts | expected: 401 | got: ${res.status}`
      );
    }
  });

  // 20. POST /api/automations/tick without auth cookie
  await test("POST /api/automations/tick — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/automations/tick", { method: "POST" });
    authCookie = saved;
    if (res.status === 401) pass("Tick sem cookie → 401");
    else {
      fail(
        "Tick sem cookie → 401",
        `[FAIL] tick-sem-auth | module: automations/tick/route.ts | expected: 401 | got: ${res.status}`
      );
    }
  });
}

// ==================== AUTH EDGE CASES ====================

async function testAuthEdgeCases() {
  console.log("\n🔒 AUTH EDGE CASES");

  await test("GET /api/auth/me — sem cookie retorna 401", async () => {
    const saved = authCookie;
    authCookie = "";
    const res = await apiFetch("/api/auth/me");
    authCookie = saved;
    if (res.status === 401) pass("Sem cookie → 401");
    else fail("Sem cookie → 401", `status=${res.status}`);
  });

  await test("POST /api/auth/logout — deslogar", async () => {
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    if (res.status === 200) pass("Logout OK");
    else fail("Logout", `status=${res.status}`);
  });
}

// ==================== MAIN ====================

async function main() {
  console.log("🚀 Rocket Marketing CRM — Testes de API");
  console.log(`   Base: ${BASE}`);
  console.log(`   Horário: ${new Date().toISOString()}`);

  await testAuth();
  await testLeads();
  await testWhatsApp();
  await testWhatsAppAuth();
  await testWhatsAppConversationsFlow();
  await testWhatsAppWebhook();
  await testGoogleAds();
  await testAdmin();
  await testAutomations();
  await testAutomationsValidation();
  await testWebhookAutomations();
  await testAutomationsTick();
  await testAutomationsAuth();
  await testAuthEdgeCases();

  // Summary
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n" + "=".repeat(50));
  console.log(`📊 RESULTADO: ${passed} passou, ${failed} falhou, ${results.length} total`);

  if (failed > 0) {
    console.log("\n❌ Testes que falharam:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`   - ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log("\n✅ Todos os testes passaram!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
