"use client";

import { Zap } from "lucide-react";

export default function AutomationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Automações</h1>
      <div className="bg-card rounded-xl p-12 text-center">
        <Zap className="w-12 h-12 text-warning mx-auto mb-4 opacity-50" />
        <h2 className="text-lg font-semibold mb-2">Em breve — Fase 2</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          O sistema de automações será implementado na próxima fase, incluindo
          gatilhos por entrada no funil, follow-up, mudança de etapa e
          palavras-chave.
        </p>
      </div>
    </div>
  );
}
