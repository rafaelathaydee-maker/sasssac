import { DragEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Contact, PipelineStage } from "../types";

const STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: "NEW_LEAD", label: "Novo lead", color: "border-gray-300" },
  { id: "NEGOTIATION", label: "Em negociação", color: "border-blue-300" },
  { id: "PROPOSAL", label: "Proposta", color: "border-amber-300" },
  { id: "WON", label: "Fechado", color: "border-green-300" },
  { id: "LOST", label: "Perdido", color: "border-red-300" },
];

export function CrmPipeline() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function load() {
    api.get("/crm/pipeline").then(({ data }) => setContacts(data));
  }
  useEffect(load, []);

  async function moveTo(contactId: string, stage: PipelineStage) {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, pipelineStage: stage } : c)));
    await api.patch(`/crm/contacts/${contactId}/stage`, { stage }).catch(load);
  }

  function onDrop(e: DragEvent, stage: PipelineStage) {
    e.preventDefault();
    if (draggingId) moveTo(draggingId, stage);
    setDraggingId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Funil de vendas (CRM)</h1>
          <p className="text-xs text-gray-400">Arraste os contatos entre as etapas</p>
        </div>
        <Link to="/inbox" className="text-sm text-blue-600 hover:underline">← Voltar pra inbox</Link>
      </header>

      <main className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const items = contacts.filter((c) => (c.pipelineStage || "NEW_LEAD") === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.id)}
                className={`w-64 bg-white border-t-4 ${stage.color} rounded-lg shadow-sm flex flex-col max-h-[75vh]`}
              >
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{stage.label}</p>
                  <span className="text-xs text-gray-400">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggingId(c.id)}
                      className="bg-gray-50 border rounded-md px-3 py-2 text-sm cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-medium text-gray-800 truncate">{c.name}</p>
                      {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.tags.map((t) => (
                            <span key={t} className="text-[10px] bg-blue-50 text-blue-600 rounded-full px-1.5">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Vazio</p>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
