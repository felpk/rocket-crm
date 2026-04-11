import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing module
vi.mock("@/lib/db", () => ({
  prisma: {
    googleAdsConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function stubGoogleAdsEnv() {
  vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "test-token");
  vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "test-secret");
  vi.stubEnv("GOOGLE_ADS_REDIRECT_URI", "http://localhost/callback");
}

async function loadModule() {
  vi.resetModules();
  return await import("@/lib/google-ads");
}

// parseGoogleAdsError is a pure function, safe to import statically
import { parseGoogleAdsError } from "@/lib/google-ads";

describe("parseGoogleAdsError", () => {
  it("retorna mensagem para NOT_ADS_USER", () => {
    const msg = parseGoogleAdsError("Error: NOT_ADS_USER - this account is not an ads user");
    expect(msg).toContain("conta Google Ads associada");
  });

  it("retorna mensagem para CUSTOMER_NOT_ENABLED", () => {
    const msg = parseGoogleAdsError("CUSTOMER_NOT_ENABLED: account is not enabled");
    expect(msg).toContain("ativada");
  });

  it("retorna mensagem para conta suspensa", () => {
    const msg = parseGoogleAdsError("Error: account NOT_ACTIVE, suspended");
    expect(msg).toContain("suspensa ou cancelada");
  });

  it("retorna mensagem para billing/payment", () => {
    const msg = parseGoogleAdsError("billing setup required for this account");
    expect(msg).toContain("faturamento");
  });

  it("retorna mensagem para permission denied", () => {
    const msg = parseGoogleAdsError("ACCESS_DENIED: permission denied for this resource");
    expect(msg).toContain("permiss");
  });

  it("retorna mensagem para developer token", () => {
    const msg = parseGoogleAdsError("invalid developer_token provided");
    expect(msg).toContain("developer token");
  });

  it("retorna mensagem para rate limit", () => {
    const msg = parseGoogleAdsError("RATE_LIMIT_EXCEEDED: quota exhausted");
    expect(msg).toContain("Limite de requisi");
  });

  it("retorna mensagem para invalid customer id", () => {
    const msg = parseGoogleAdsError("INVALID_CUSTOMER_ID: bad id format");
    expect(msg).toContain("inv");
  });

  it("trunca mensagens longas no fallback", () => {
    const longError = "Error: " + "x".repeat(300);
    const msg = parseGoogleAdsError(longError);
    expect(msg.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it("limpa prefixos Error: e Google Ads API:", () => {
    const msg = parseGoogleAdsError("Google Ads API: something unknown happened");
    expect(msg).not.toContain("Google Ads API:");
    expect(msg).toContain("something unknown happened");
  });
});

describe("Google Ads demo mode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getCampaignMetrics retorna campanhas demo quando GOOGLE_ADS_DEMO=true", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "true");

    const { getCampaignMetrics } = await loadModule();
    const campaigns = await getCampaignMetrics("123", "fake-token");

    expect(campaigns).toBeInstanceOf(Array);
    expect(campaigns.length).toBeGreaterThan(0);

    for (const c of campaigns) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("impressions");
      expect(c).toHaveProperty("clicks");
      expect(c).toHaveProperty("ctr");
      expect(c).toHaveProperty("cpc");
      expect(c).toHaveProperty("spend");
      expect(typeof c.name).toBe("string");
      expect(typeof c.impressions).toBe("number");
      expect(c.impressions).toBeGreaterThanOrEqual(0);
      expect(c.clicks).toBeGreaterThanOrEqual(0);
      expect(c.spend).toBeGreaterThanOrEqual(0);
      expect(["ENABLED", "PAUSED", "REMOVED"]).toContain(c.status);
    }
  });

  it("getAccountSummary retorna totais agregados corretamente em demo", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "true");

    const { getAccountSummary, getCampaignMetrics } = await loadModule();

    const summary = await getAccountSummary("123", "fake-token");
    const campaigns = await getCampaignMetrics("123", "fake-token");

    expect(summary).toHaveProperty("impressions");
    expect(summary).toHaveProperty("clicks");
    expect(summary).toHaveProperty("ctr");
    expect(summary).toHaveProperty("cpc");
    expect(summary).toHaveProperty("spend");

    const expectedImpressions = campaigns.reduce((s: number, c: any) => s + c.impressions, 0);
    const expectedClicks = campaigns.reduce((s: number, c: any) => s + c.clicks, 0);
    const expectedSpend = campaigns.reduce((s: number, c: any) => s + c.spend, 0);

    expect(summary.impressions).toBe(expectedImpressions);
    expect(summary.clicks).toBe(expectedClicks);
    expect(summary.spend).toBeCloseTo(expectedSpend, 2);
    expect(summary.ctr).toBeCloseTo(expectedClicks / expectedImpressions, 6);
    expect(summary.cpc).toBeCloseTo(expectedSpend / expectedClicks, 2);
  });

  it("demo campanhas tem pelo menos uma ativa e uma pausada", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "true");

    const { getCampaignMetrics } = await loadModule();
    const campaigns = await getCampaignMetrics("123", "fake-token");

    const statuses = campaigns.map((c: any) => c.status);
    expect(statuses).toContain("ENABLED");
    expect(statuses).toContain("PAUSED");
  });
});

describe("Google Ads API - real mode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getAccountSummary retorna zeros quando API retorna vazio", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getAccountSummary } = await loadModule();
    const summary = await getAccountSummary("123", "fake-token");

    expect(summary.impressions).toBe(0);
    expect(summary.clicks).toBe(0);
    expect(summary.ctr).toBe(0);
    expect(summary.cpc).toBe(0);
    expect(summary.spend).toBe(0);
  });

  it("getCampaignMetrics lanca erro quando API retorna 403", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"error":{"message":"ACCESS_DENIED"}}'),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getCampaignMetrics } = await loadModule();

    await expect(getCampaignMetrics("123", "fake-token")).rejects.toThrow("Google Ads API");
  });

  it("getCampaignMetrics lanca erro quando API retorna HTML (502)", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("<!DOCTYPE html><html><body>Bad Gateway</body></html>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getCampaignMetrics } = await loadModule();

    await expect(getCampaignMetrics("123", "fake-token")).rejects.toThrow("URL possivelmente incorreta");
  });

  it("mapeia campanhas corretamente da resposta da API", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockResponse = {
      results: [
        {
          campaign: { name: "Test Campaign", status: "ENABLED" },
          metrics: {
            impressions: "10000",
            clicks: "500",
            ctr: 0.05,
            averageCpc: "2500000",
            costMicros: "1250000000",
          },
        },
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const { getCampaignMetrics } = await loadModule();
    const campaigns = await getCampaignMetrics("123", "fake-token");

    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Test Campaign");
    expect(campaigns[0].status).toBe("ENABLED");
    expect(campaigns[0].impressions).toBe(10000);
    expect(campaigns[0].clicks).toBe(500);
    expect(campaigns[0].ctr).toBe(0.05);
    expect(campaigns[0].cpc).toBeCloseTo(2.5, 2);
    expect(campaigns[0].spend).toBeCloseTo(1250.0, 2);
  });

  it("trata campos vazios/nulos na resposta como zero", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          campaign: { name: "Empty", status: "PAUSED" },
          metrics: { impressions: "", clicks: "", ctr: 0, averageCpc: 0, costMicros: "" },
        }],
      }),
    }));

    const { getCampaignMetrics } = await loadModule();
    const campaigns = await getCampaignMetrics("123", "fake-token");

    expect(campaigns[0].impressions).toBe(0);
    expect(campaigns[0].clicks).toBe(0);
    expect(campaigns[0].ctr).toBe(0);
    expect(campaigns[0].cpc).toBe(0);
    expect(campaigns[0].spend).toBe(0);
  });

  it("remove hifens do customerId na URL da API", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getCampaignMetrics } = await loadModule();
    await getCampaignMetrics("123-456-7890", "fake-token");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("customers/1234567890");
    expect(calledUrl).not.toContain("-");
  });

  it("envia headers corretos (Authorization, developer-token)", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getCampaignMetrics } = await loadModule();
    await getCampaignMetrics("123", "my-access-token");

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers.Authorization).toBe("Bearer my-access-token");
    expect(calledOptions.headers["developer-token"]).toBe("test-token");
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
  });

  it("agrega summary de multiplas linhas corretamente", async () => {
    stubGoogleAdsEnv();
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { metrics: { impressions: "1000", clicks: "50", costMicros: "500000000" } },
          { metrics: { impressions: "2000", clicks: "100", costMicros: "1000000000" } },
        ],
      }),
    }));

    const { getAccountSummary } = await loadModule();
    const summary = await getAccountSummary("123", "fake-token");

    expect(summary.impressions).toBe(3000);
    expect(summary.clicks).toBe(150);
    expect(summary.spend).toBeCloseTo(1500, 2);
    expect(summary.ctr).toBeCloseTo(150 / 3000, 6);
    expect(summary.cpc).toBeCloseTo(1500 / 150, 2);
  });
});

describe("Google Ads env validation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lanca erro quando env vars estao faltando", async () => {
    vi.stubEnv("GOOGLE_ADS_DEMO", "false");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_ADS_REDIRECT_URI", "");

    vi.stubGlobal("fetch", vi.fn());

    const { getCampaignMetrics } = await loadModule();

    await expect(getCampaignMetrics("123", "fake-token")).rejects.toThrow("faltando");
  });
});
