import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Contact, PipelineStage } from "../types";

interface Props {
  contact: Contact;
  onUpdated: (contact: Contact) => void;
}

export function ContactInfoPanel({ contact, onUpdated }: Props) {
  const [phone, setPhone] = useState(contact.phone || "");
  const [email, setEmail] = useState(contact.email || "");
  const [notes, setNotes] = useState(contact.notes || "");
  const [tagDraft, setTagDraft] = useState("");
  const [tags, setTags] = useState<string[]>(contact.tags || []);
  const [stage, setStage] = useState<PipelineStage>(contact.pipelineStage || "NEW_LEAD");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // troca de conversa selecionada -> recarrega os campos do contato certo
  useEffect(() => {
    setPhone(contact.phone || "");
    setEmail(contact.email || "");
    setNotes(contact.notes || "");
    setTags(contact.tags || []);
    setStage(contact.pipelineStage || "NEW_LEAD");
  }, [contact.id]);

  async function save(partial: Partial<{ phone: string; email: string; notes: string; tags: string[] }>) {
    setSaving(true);
    try {
      const { data } = await api.patch(`/contacts/${contact.id}`, partial);
      onUpdated(data);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const value = tagDraft.trim();
    if (!value || tags.includes(value)) {
      setTagDraft("");
      return;
    }
    const next = [...tags, value];
    setTags(next);
    setTagDraft("");
    save({ tags: next });
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    save({ tags: next });
  }

  async function changeStage(newStage: PipelineStage) {
    setStage(newStage);
    const { data } = await api.patch(`/crm/contacts/${contact.id}/stage`, { stage: newStage });
    onUpdated(data);
  }

  return (
    <aside className="w-72 border-l bg-white flex flex-col">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-sm text-gray-800">{contact.name}</p>
        <p className="text-xs text-gray-400">Informações do cliente</p>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label className="text-[11px] font-medium text-gray-400 uppercase">Etapa do funil</label>
          <select
            value={stage}
            onChange={(e) => changeStage(e.target.value as PipelineStage)}
            className="w-full border rounded-md px-2.5 py-1.5 text-sm mt-1"
          >
            <option value="NEW_LEAD">Novo lead</option>
            <option value="NEGOTIATION">Em negociação</option>
            <option value="PROPOSAL">Proposta</option>
            <option value="WON">Fechado</option>
            <option value="LOST">Perdido</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-400 uppercase">Telefone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => save({ phone })}
            placeholder="(11) 99999-0000"
            className="w-full border rounded-md px-2.5 py-1.5 text-sm mt-1"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-400 uppercase">E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => save({ email })}
            placeholder="cliente@email.com"
            className="w-full border rounded-md px-2.5 py-1.5 text-sm mt-1"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-400 uppercase">Tags</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="text-blue-400 hover:text-blue-700">
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Adicionar tag e Enter"
            className="w-full border rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-400 uppercase">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => save({ notes })}
            placeholder="Anotações internas sobre esse cliente..."
            rows={5}
            className="w-full border rounded-md px-2.5 py-1.5 text-sm mt-1 resize-none"
          />
        </div>

        <p className="text-[11px] text-gray-300">
          {saving ? "Salvando..." : savedAt ? "Alterações salvas." : ""}
        </p>
      </div>
    </aside>
  );
}
