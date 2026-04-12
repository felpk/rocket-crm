/**
 * Demo data generators for all Google Ads endpoints.
 * Used when GOOGLE_ADS_DEMO=true to provide realistic mock data.
 */

// --- Types ---

export interface DemoCampaign {
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number;
  searchImpressionShare: number;
}

export interface DemoSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number;
}

export interface DemoAdGroup {
  campaignName: string;
  campaignId: string;
  name: string;
  id: string;
  status: string;
  cpcBid: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

export interface DemoKeyword {
  campaignName: string;
  adGroupName: string;
  text: string;
  matchType: string;
  qualityScore: number;
  bid: number;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
}

export interface DemoSearchTerm {
  searchTerm: string;
  campaignName: string;
  adGroupName: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}

export interface DemoDevice {
  device: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

export interface DemoAge {
  ageRange: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface DemoGender {
  gender: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface DemoLocation {
  location: string;
  locationType: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}

export interface DemoDailyPoint {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

export interface DemoBudget {
  campaignName: string;
  status: string;
  dailyBudget: number;
  spend: number;
  utilization: number;
}

export interface DemoChangeEvent {
  date: string;
  resourceType: string;
  operation: string;
  userEmail: string;
}

export interface DemoRecommendation {
  type: string;
  campaign: string;
  impactImpressions: number;
  impactClicks: number;
  impactCost: number;
  potentialImpressions: number;
  potentialClicks: number;
  potentialCost: number;
}

export interface DemoAd {
  campaignName: string;
  adGroupName: string;
  headlines: string[];
  descriptions: string[];
  finalUrls: string[];
  status: string;
  approvalStatus: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}

export interface DemoAccount {
  id: string;
  name: string;
}

// --- Generators ---

export function getDemoCampaigns(): DemoCampaign[] {
  return [
    {
      name: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      status: "ENABLED",
      impressions: 18420,
      clicks: 1253,
      ctr: 0.068,
      cpc: 2.87,
      spend: 3596.11,
      conversions: 47,
      conversionsValue: 23500,
      costPerConversion: 76.51,
      searchImpressionShare: 0.42,
    },
    {
      name: "Implantes Fortaleza",
      status: "ENABLED",
      impressions: 12350,
      clicks: 876,
      ctr: 0.0709,
      cpc: 3.12,
      spend: 2733.12,
      conversions: 31,
      conversionsValue: 15500,
      costPerConversion: 88.16,
      searchImpressionShare: 0.38,
    },
    {
      name: "Clinica Sorriso — Lentes de Contato",
      status: "ENABLED",
      impressions: 9870,
      clicks: 542,
      ctr: 0.0549,
      cpc: 4.15,
      spend: 2249.30,
      conversions: 18,
      conversionsValue: 9000,
      costPerConversion: 124.96,
      searchImpressionShare: 0.55,
    },
    {
      name: "Curso de Violao 3.0",
      status: "PAUSED",
      impressions: 3210,
      clicks: 198,
      ctr: 0.0617,
      cpc: 1.45,
      spend: 287.10,
      conversions: 12,
      conversionsValue: 2388,
      costPerConversion: 23.93,
      searchImpressionShare: 0.61,
    },
    {
      name: "Kickboxing em casa | Guia",
      status: "PAUSED",
      impressions: 1540,
      clicks: 87,
      ctr: 0.0565,
      cpc: 0.92,
      spend: 80.04,
      conversions: 4,
      conversionsValue: 316,
      costPerConversion: 20.01,
      searchImpressionShare: 0.73,
    },
  ];
}

export function getDemoSummary(): DemoSummary {
  const campaigns = getDemoCampaigns();
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const conversionsValue = campaigns.reduce((s, c) => s + c.conversionsValue, 0);
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    spend,
    conversions,
    conversionsValue,
    costPerConversion: conversions > 0 ? spend / conversions : 0,
  };
}

export function getDemoAdGroups(): DemoAdGroup[] {
  return [
    {
      campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      campaignId: "camp_001",
      name: "Implante Dentario — Exato",
      id: "ag_001",
      status: "ENABLED",
      cpcBid: 3.50,
      impressions: 10200,
      clicks: 742,
      ctr: 0.0727,
      cpc: 2.95,
      spend: 2188.90,
      conversions: 29,
      conversionsValue: 14500,
    },
    {
      campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      campaignId: "camp_001",
      name: "Protese Fixa — Amplo",
      id: "ag_002",
      status: "ENABLED",
      cpcBid: 2.80,
      impressions: 8220,
      clicks: 511,
      ctr: 0.0622,
      cpc: 2.75,
      spend: 1405.25,
      conversions: 18,
      conversionsValue: 9000,
    },
    {
      campaignName: "Implantes Fortaleza",
      campaignId: "camp_002",
      name: "Implante Fortaleza — Pesquisa",
      id: "ag_003",
      status: "ENABLED",
      cpcBid: 3.20,
      impressions: 7800,
      clicks: 556,
      ctr: 0.0713,
      cpc: 3.10,
      spend: 1723.60,
      conversions: 20,
      conversionsValue: 10000,
    },
    {
      campaignName: "Implantes Fortaleza",
      campaignId: "camp_002",
      name: "Implante Barato — Frase",
      id: "ag_004",
      status: "ENABLED",
      cpcBid: 2.50,
      impressions: 4550,
      clicks: 320,
      ctr: 0.0703,
      cpc: 3.15,
      spend: 1008.00,
      conversions: 11,
      conversionsValue: 5500,
    },
    {
      campaignName: "Clinica Sorriso — Lentes de Contato",
      campaignId: "camp_003",
      name: "Lentes de Contato Dental",
      id: "ag_005",
      status: "ENABLED",
      cpcBid: 4.50,
      impressions: 9870,
      clicks: 542,
      ctr: 0.0549,
      cpc: 4.15,
      spend: 2249.30,
      conversions: 18,
      conversionsValue: 9000,
    },
  ];
}

export function getDemoKeywords(): DemoKeyword[] {
  return [
    { campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Implante Dentario — Exato", text: "implante dentario fortaleza", matchType: "EXACT", qualityScore: 8, bid: 3.50, status: "ENABLED", impressions: 5200, clicks: 410, ctr: 0.0788, cpc: 2.90, spend: 1189.00, conversions: 16 },
    { campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Implante Dentario — Exato", text: "implante dentario preco", matchType: "PHRASE", qualityScore: 7, bid: 3.20, status: "ENABLED", impressions: 3100, clicks: 198, ctr: 0.0639, cpc: 3.10, spend: 613.80, conversions: 8 },
    { campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Protese Fixa — Amplo", text: "protese dentaria fixa", matchType: "BROAD", qualityScore: 6, bid: 2.80, status: "ENABLED", impressions: 4500, clicks: 287, ctr: 0.0638, cpc: 2.75, spend: 789.25, conversions: 10 },
    { campaignName: "Implantes Fortaleza", adGroupName: "Implante Fortaleza — Pesquisa", text: "melhor dentista implante fortaleza", matchType: "PHRASE", qualityScore: 9, bid: 3.40, status: "ENABLED", impressions: 4200, clicks: 312, ctr: 0.0743, cpc: 3.05, spend: 951.60, conversions: 12 },
    { campaignName: "Implantes Fortaleza", adGroupName: "Implante Barato — Frase", text: "implante dentario barato", matchType: "PHRASE", qualityScore: 5, bid: 2.50, status: "ENABLED", impressions: 3800, clicks: 245, ctr: 0.0645, cpc: 3.20, spend: 784.00, conversions: 7 },
    { campaignName: "Clinica Sorriso — Lentes de Contato", adGroupName: "Lentes de Contato Dental", text: "lente de contato dental", matchType: "EXACT", qualityScore: 8, bid: 4.50, status: "ENABLED", impressions: 5400, clicks: 298, ctr: 0.0552, cpc: 4.10, spend: 1221.80, conversions: 10 },
    { campaignName: "Clinica Sorriso — Lentes de Contato", adGroupName: "Lentes de Contato Dental", text: "faceta de porcelana preco", matchType: "BROAD", qualityScore: 6, bid: 3.80, status: "ENABLED", impressions: 4470, clicks: 244, ctr: 0.0546, cpc: 4.21, spend: 1027.24, conversions: 8 },
  ];
}

export function getDemoSearchTerms(): DemoSearchTerm[] {
  return [
    { searchTerm: "implante dentario em fortaleza preco", campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Implante Dentario — Exato", status: "ADDED", impressions: 1200, clicks: 98, ctr: 0.0817, spend: 284.20, conversions: 5 },
    { searchTerm: "quanto custa um implante dentario", campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Implante Dentario — Exato", status: "NONE", impressions: 980, clicks: 72, ctr: 0.0735, spend: 208.80, conversions: 3 },
    { searchTerm: "melhor clinica de implante fortaleza", campaignName: "Implantes Fortaleza", adGroupName: "Implante Fortaleza — Pesquisa", status: "NONE", impressions: 870, clicks: 65, ctr: 0.0747, spend: 195.00, conversions: 3 },
    { searchTerm: "implante dentario barato fortaleza", campaignName: "Implantes Fortaleza", adGroupName: "Implante Barato — Frase", status: "ADDED", impressions: 650, clicks: 48, ctr: 0.0738, spend: 153.60, conversions: 2 },
    { searchTerm: "lente de contato para dente valor", campaignName: "Clinica Sorriso — Lentes de Contato", adGroupName: "Lentes de Contato Dental", status: "NONE", impressions: 540, clicks: 31, ctr: 0.0574, spend: 127.10, conversions: 1 },
    { searchTerm: "faceta porcelana fortaleza", campaignName: "Clinica Sorriso — Lentes de Contato", adGroupName: "Lentes de Contato Dental", status: "NONE", impressions: 430, clicks: 25, ctr: 0.0581, spend: 102.50, conversions: 1 },
    { searchTerm: "protese fixa sobre implante", campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", adGroupName: "Protese Fixa — Amplo", status: "EXCLUDED", impressions: 320, clicks: 18, ctr: 0.0563, spend: 48.60, conversions: 0 },
    { searchTerm: "como fazer implante dentario pelo sus", campaignName: "Implantes Fortaleza", adGroupName: "Implante Barato — Frase", status: "EXCLUDED", impressions: 280, clicks: 15, ctr: 0.0536, spend: 43.50, conversions: 0 },
  ];
}

export function getDemoDevices(): DemoDevice[] {
  return [
    { device: "MOBILE", impressions: 28900, clicks: 1950, ctr: 0.0675, cpc: 2.85, spend: 5557.50, conversions: 68, conversionsValue: 34000 },
    { device: "DESKTOP", impressions: 13200, clicks: 830, ctr: 0.0629, cpc: 3.45, spend: 2863.50, conversions: 38, conversionsValue: 19000 },
    { device: "TABLET", impressions: 3290, clicks: 176, ctr: 0.0535, cpc: 2.95, spend: 519.20, conversions: 6, conversionsValue: 1704 },
  ];
}

export function getDemoDemographics(): { age: DemoAge[]; gender: DemoGender[] } {
  return {
    age: [
      { ageRange: "AGE_RANGE_25_34", impressions: 12500, clicks: 890, spend: 2581.00, conversions: 32 },
      { ageRange: "AGE_RANGE_35_44", impressions: 14200, clicks: 980, spend: 2842.00, conversions: 38 },
      { ageRange: "AGE_RANGE_45_54", impressions: 10800, clicks: 620, spend: 1798.00, conversions: 24 },
      { ageRange: "AGE_RANGE_55_64", impressions: 5200, clicks: 310, spend: 899.00, conversions: 12 },
      { ageRange: "AGE_RANGE_65_UP", impressions: 2690, clicks: 156, spend: 452.20, conversions: 6 },
      { ageRange: "AGE_RANGE_18_24", impressions: 1800, clicks: 85, spend: 246.50, conversions: 2 },
    ],
    gender: [
      { gender: "FEMALE", impressions: 27100, clicks: 1820, spend: 5278.00, conversions: 72 },
      { gender: "MALE", impressions: 18290, clicks: 1136, spend: 3540.70, conversions: 40 },
    ],
  };
}

export function getDemoLocations(): DemoLocation[] {
  return [
    { location: "Fortaleza", locationType: "CITY", impressions: 28500, clicks: 1920, ctr: 0.0674, spend: 5568.00, conversions: 72 },
    { location: "Maracanau", locationType: "CITY", impressions: 4200, clicks: 280, ctr: 0.0667, spend: 812.00, conversions: 10 },
    { location: "Caucaia", locationType: "CITY", impressions: 3800, clicks: 248, ctr: 0.0653, spend: 719.20, conversions: 8 },
    { location: "Eusebio", locationType: "CITY", impressions: 2900, clicks: 198, ctr: 0.0683, spend: 574.20, conversions: 7 },
    { location: "Aquiraz", locationType: "CITY", impressions: 1800, clicks: 115, ctr: 0.0639, spend: 333.50, conversions: 4 },
    { location: "Pacatuba", locationType: "CITY", impressions: 1200, clicks: 72, ctr: 0.06, spend: 208.80, conversions: 2 },
  ];
}

export function getDemoDaily(): DemoDailyPoint[] {
  const points: DemoDailyPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const base = 1200 + Math.floor(Math.random() * 600);
    const clickRate = 0.055 + Math.random() * 0.03;
    const clicks = Math.floor(base * clickRate);
    const spend = clicks * (2.5 + Math.random() * 1.5);
    const conversions = Math.floor(clicks * (0.03 + Math.random() * 0.02));
    points.push({
      date: dateStr,
      impressions: base,
      clicks,
      spend: Math.round(spend * 100) / 100,
      conversions,
      conversionsValue: conversions * 500,
    });
  }
  return points;
}

export function getDemoBudgets(): DemoBudget[] {
  return [
    { campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", status: "ENABLED", dailyBudget: 150, spend: 119.87, utilization: 0.80 },
    { campaignName: "Implantes Fortaleza", status: "ENABLED", dailyBudget: 120, spend: 91.10, utilization: 0.76 },
    { campaignName: "Clinica Sorriso — Lentes de Contato", status: "ENABLED", dailyBudget: 100, spend: 74.98, utilization: 0.75 },
    { campaignName: "Curso de Violao 3.0", status: "PAUSED", dailyBudget: 30, spend: 0, utilization: 0 },
    { campaignName: "Kickboxing em casa | Guia", status: "PAUSED", dailyBudget: 20, spend: 0, utilization: 0 },
  ];
}

export function getDemoChangeHistory(): DemoChangeEvent[] {
  const now = new Date();
  return [
    { date: new Date(now.getTime() - 2 * 3600000).toISOString(), resourceType: "CAMPAIGN_BUDGET", operation: "UPDATE", userEmail: "rocketmidia09@gmail.com" },
    { date: new Date(now.getTime() - 8 * 3600000).toISOString(), resourceType: "AD_GROUP_BID_MODIFIER", operation: "UPDATE", userEmail: "rocketmidia09@gmail.com" },
    { date: new Date(now.getTime() - 24 * 3600000).toISOString(), resourceType: "AD", operation: "CREATE", userEmail: "rocketmidia09@gmail.com" },
    { date: new Date(now.getTime() - 48 * 3600000).toISOString(), resourceType: "CAMPAIGN", operation: "UPDATE", userEmail: "rocketmidia09@gmail.com" },
    { date: new Date(now.getTime() - 72 * 3600000).toISOString(), resourceType: "AD_GROUP_CRITERION", operation: "CREATE", userEmail: "rocketmidia09@gmail.com" },
    { date: new Date(now.getTime() - 96 * 3600000).toISOString(), resourceType: "CAMPAIGN_BUDGET", operation: "UPDATE", userEmail: "rocketmidia09@gmail.com" },
  ];
}

export function getDemoRecommendations(): DemoRecommendation[] {
  return [
    { type: "KEYWORD", campaign: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", impactImpressions: 18420, impactClicks: 1253, impactCost: 3596.11, potentialImpressions: 22100, potentialClicks: 1504, potentialCost: 4315.00 },
    { type: "TARGET_CPA_OPT_IN", campaign: "Implantes Fortaleza", impactImpressions: 12350, impactClicks: 876, impactCost: 2733.12, potentialImpressions: 14820, potentialClicks: 1051, potentialCost: 2520.00 },
    { type: "TEXT_AD", campaign: "Clinica Sorriso — Lentes de Contato", impactImpressions: 9870, impactClicks: 542, impactCost: 2249.30, potentialImpressions: 11844, potentialClicks: 650, potentialCost: 2249.30 },
    { type: "SITELINK_EXTENSION", campaign: "Dr. Thiago Dantas [Pesquisa] [Implante] +45", impactImpressions: 18420, impactClicks: 1253, impactCost: 3596.11, potentialImpressions: 20262, potentialClicks: 1378, potentialCost: 3596.11 },
  ];
}

export function getDemoAds(): DemoAd[] {
  return [
    {
      campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      adGroupName: "Implante Dentario — Exato",
      headlines: ["Implante Dentario Fortaleza", "Dr. Thiago Dantas", "Agende Sua Consulta"],
      descriptions: ["Implantes de alta qualidade com profissional experiente. Agende agora!", "Mais de 10 anos de experiencia em implantes. Consulta gratuita."],
      finalUrls: ["https://drthiagodantas.com.br/implantes"],
      status: "ENABLED",
      approvalStatus: "APPROVED",
      impressions: 10200,
      clicks: 742,
      ctr: 0.0727,
      spend: 2188.90,
      conversions: 29,
    },
    {
      campaignName: "Dr. Thiago Dantas [Pesquisa] [Implante] +45",
      adGroupName: "Protese Fixa — Amplo",
      headlines: ["Protese Fixa em Fortaleza", "Resultado Natural", "Parcele em 12x"],
      descriptions: ["Protese fixa sobre implante com resultado estetico natural.", "Parcele seu tratamento. Agende uma avaliacao sem compromisso."],
      finalUrls: ["https://drthiagodantas.com.br/protese-fixa"],
      status: "ENABLED",
      approvalStatus: "APPROVED",
      impressions: 8220,
      clicks: 511,
      ctr: 0.0622,
      spend: 1405.25,
      conversions: 18,
    },
    {
      campaignName: "Implantes Fortaleza",
      adGroupName: "Implante Fortaleza — Pesquisa",
      headlines: ["Implantes Dentarios", "Melhor Clinica de Fortaleza", "Tecnologia de Ponta"],
      descriptions: ["Implantes com tecnologia de ponta e equipe especializada.", "Avaliacao gratuita. Atendemos Fortaleza e regiao metropolitana."],
      finalUrls: ["https://implantesfortaleza.com.br"],
      status: "ENABLED",
      approvalStatus: "APPROVED",
      impressions: 7800,
      clicks: 556,
      ctr: 0.0713,
      spend: 1723.60,
      conversions: 20,
    },
    {
      campaignName: "Clinica Sorriso — Lentes de Contato",
      adGroupName: "Lentes de Contato Dental",
      headlines: ["Lentes de Contato Dental", "Sorriso Perfeito", "Clinica Sorriso"],
      descriptions: ["Lentes de contato dental para um sorriso perfeito e natural.", "Avaliacao + planejamento digital gratis. Agende hoje!"],
      finalUrls: ["https://clinicasorriso.com.br/lentes"],
      status: "ENABLED",
      approvalStatus: "APPROVED",
      impressions: 9870,
      clicks: 542,
      ctr: 0.0549,
      spend: 2249.30,
      conversions: 18,
    },
  ];
}

export function getDemoAccounts(): DemoAccount[] {
  return [
    { id: "1234567890", name: "Dr. Thiago Dantas — Implantes" },
    { id: "9876543210", name: "Clinica Sorriso Fortaleza" },
    { id: "5555555555", name: "Rocket Midia — MCC Test" },
  ];
}
