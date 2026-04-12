"use client";

import { formatCurrency } from "@/lib/utils";

interface Device {
  device: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
}

interface AgeData {
  ageRange: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

interface GenderData {
  gender: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

interface Location {
  location: string;
  locationType: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
}

interface Props {
  devices: Device[];
  demographics: { age: AgeData[]; gender: GenderData[] };
  locations: Location[];
}

const deviceLabels: Record<string, string> = {
  MOBILE: "Mobile",
  DESKTOP: "Desktop",
  TABLET: "Tablet",
  UNKNOWN: "Outros",
};

const ageLabels: Record<string, string> = {
  AGE_RANGE_18_24: "18-24",
  AGE_RANGE_25_34: "25-34",
  AGE_RANGE_35_44: "35-44",
  AGE_RANGE_45_54: "45-54",
  AGE_RANGE_55_64: "55-64",
  AGE_RANGE_65_UP: "65+",
};

const genderLabels: Record<string, string> = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  UNDETERMINED: "Indeterminado",
};

export default function AudiencePanel({
  devices,
  demographics,
  locations,
}: Props) {
  return (
    <div>
      {/* Dispositivos */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Dispositivos</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Dispositivo</th>
                <th className="text-right p-3 font-medium">Impressoes</th>
                <th className="text-right p-3 font-medium">Cliques</th>
                <th className="text-right p-3 font-medium">CTR</th>
                <th className="text-right p-3 font-medium">CPC</th>
                <th className="text-right p-3 font-medium">Custo</th>
                <th className="text-right p-3 font-medium">Conversoes</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">
                    {deviceLabels[d.device] ?? d.device}
                  </td>
                  <td className="p-3 text-right">
                    {d.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {d.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {(d.ctr * 100).toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">{formatCurrency(d.cpc)}</td>
                  <td className="p-3 text-right">
                    {formatCurrency(d.spend)}
                  </td>
                  <td className="p-3 text-right">{d.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demografia */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Demografia</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faixa Etaria */}
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60">
                  <th className="text-left p-3 font-medium">Faixa</th>
                  <th className="text-right p-3 font-medium">Impressoes</th>
                  <th className="text-right p-3 font-medium">Cliques</th>
                  <th className="text-right p-3 font-medium">Custo</th>
                  <th className="text-right p-3 font-medium">Conversoes</th>
                </tr>
              </thead>
              <tbody>
                {demographics.age.map((a, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-3">
                      {ageLabels[a.ageRange] ?? a.ageRange}
                    </td>
                    <td className="p-3 text-right">
                      {a.impressions.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {a.clicks.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(a.spend)}
                    </td>
                    <td className="p-3 text-right">{a.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Genero */}
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60">
                  <th className="text-left p-3 font-medium">Genero</th>
                  <th className="text-right p-3 font-medium">Impressoes</th>
                  <th className="text-right p-3 font-medium">Cliques</th>
                  <th className="text-right p-3 font-medium">Custo</th>
                  <th className="text-right p-3 font-medium">Conversoes</th>
                </tr>
              </thead>
              <tbody>
                {demographics.gender.map((g, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-3">
                      {genderLabels[g.gender] ?? g.gender}
                    </td>
                    <td className="p-3 text-right">
                      {g.impressions.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {g.clicks.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(g.spend)}
                    </td>
                    <td className="p-3 text-right">{g.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Localizacoes */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Localizacoes</h3>
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="text-left p-3 font-medium">Localizacao</th>
                <th className="text-right p-3 font-medium">Impressoes</th>
                <th className="text-right p-3 font-medium">Cliques</th>
                <th className="text-right p-3 font-medium">CTR</th>
                <th className="text-right p-3 font-medium">Custo</th>
                <th className="text-right p-3 font-medium">Conversoes</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">{loc.location}</td>
                  <td className="p-3 text-right">
                    {loc.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {loc.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3 text-right">
                    {(loc.ctr * 100).toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(loc.spend)}
                  </td>
                  <td className="p-3 text-right">{loc.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
