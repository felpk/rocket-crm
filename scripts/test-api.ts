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

  await test("GET /api/whatsapp/status — verificar conexão", async () => {
    const res = await apiFetch("/api/whatsapp/status");
    if (res.status === 200) {
      const data = await res.json();
      pass("WhatsApp status", `state=${data.instance?.state}`);
    } else {
      fail("WhatsApp status", `status=${res.status}`);
    }
  });

  await test("POST /api/whatsapp/send — campos vazios retorna 400", async () => {
    const res = await apiFetch("/api/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (res.status === 400) pass("WhatsApp send: campos vazios → 400");
    else fail("WhatsApp send: campos vazios → 400", `status=${res.status}`);
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
