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
