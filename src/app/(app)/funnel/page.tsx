"use client";

import { useEffect, useState, useCallback } from "react";
import { STAGES, formatCurrency, formatDate, type StageId } from "@/lib/utils";
import { Plus, GripVertical, Pencil, Trash2, X } from "lucide-react";

interface Lead {
  id: string; name: string; email: string | null; phone: string | null;
  company: string | null; value: number; origin: string | null;
  notes: string | null; stage: StageId; createdAt: string;
}

const emptyLead = { name: "", email: "", phone: "", company: "", value: "", origin: "", notes: "", stage: "lead" as StageId };

export default function FunnelPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyLead);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.ok) setLeads(await res.json());
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function openCreate() { setEditingLead(null); setForm(emptyLead); setShowModal(true); }
  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setForm({ name: lead.name, email: lead.email || "", phone: lead.phone || "", company: lead.company || "", value: lead.value.toString(), origin: lead.origin || "", notes: lead.notes || "", stage: lead.stage });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingLead ? `/api/leads/${editingLead.id}` : "/api/leads";
    const method = editingLead ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowModal(false); fetchLeads();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" }); fetchLeads();
  }

  async function handleDrop(stageId: StageId) {
    if (!draggedLead) return;
    await fetch(`/api/leads/${draggedLead}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: stageId }) });
    setDraggedLead(null); fetchLeads();
  }

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Funil de Vendas</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent hover:bg-accent/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className="min-w-[280px] flex-shrink-0" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(stage.id)}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                <span className="font-semibold text-sm">{stage.label}</span>
                <span className="text-xs text-muted-fg ml-auto">{stageLeads.length}</span>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-xl p-2 min-h-[400px] space-y-2">
                {stageLeads.map((lead) => (
                  <div key={lead.id} draggable onDragStart={() => setDraggedLead(lead.id)}
                    className="bg-card border border-border/50 rounded-lg p-4 cursor-grab active:cursor-grabbing hover:bg-card-hover hover:border-border hover:shadow-lg hover:shadow-accent/5 transition-all">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-muted-fg/50 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{lead.name}</p>
                        {lead.company && <p className="text-xs text-muted-fg truncate">{lead.company}</p>}
                        {lead.phone && <p className="text-xs text-muted-fg/70 mt-1">{lead.phone}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-accent font-medium">{formatCurrency(lead.value)}</span>
                          <span className="text-xs text-muted-fg/50">{formatDate(lead.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => openEdit(lead)} className="p-1.5 hover:bg-muted rounded transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-fg" />
                      </button>
                      <button onClick={() => handleDelete(lead.id)} className="p-1.5 hover:bg-error/20 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-error/50" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold">{editingLead ? "Editar Lead" : "Novo Lead"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-fg" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-muted-fg mb-1">Nome *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-muted-fg mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
                <div><label className="block text-sm text-muted-fg mb-1">Telefone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-muted-fg mb-1">Empresa</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass} /></div>
                <div><label className="block text-sm text-muted-fg mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputClass} /></div>
              </div>
              <div><label className="block text-sm text-muted-fg mb-1">Origem</label>
                <select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className={inputClass}>
                  <option value="">Selecione</option><option value="google_ads">Google Ads</option><option value="meta_ads">Meta Ads</option>
                  <option value="whatsapp">WhatsApp</option><option value="indicacao">Indicação</option><option value="organico">Orgânico</option><option value="outro">Outro</option>
                </select></div>
              <div><label className="block text-sm text-muted-fg mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass + " resize-none"} /></div>
              <button type="submit" className="w-full bg-accent hover:bg-accent/80 py-3 rounded-lg font-medium transition-colors">
                {editingLead ? "Salvar Alterações" : "Criar Lead"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
