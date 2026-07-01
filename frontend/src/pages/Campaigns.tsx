import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Campaign } from "../types";

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Enviando",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
const statusColor: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  SCHEDULED: "bg-blue-100 text-blue-700",
  SENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function Campaigns() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [tag, setTag] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rateLimit, setRateLimit] = useState(20);

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN") navigate("/inbox");
  }, [loading, user, navigate]);

  function load() {
    api.get("/campaigns").then(({ data }) => setCampaigns(data));
  }
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // acompanha o progresso do envio quase em tempo real
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/campaigns", {
        name,
        message,
        tag,
        rateLimitPerMinute: rateLimit,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      setShowForm(false);
      setName(""); setMessage(""); setTag(""); setScheduledAt("");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Não foi possível criar a campanha");
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancelar esta campanha? Quem ainda não recebeu não vai mais receber.")) return;
    await api.post(`/campaigns/${id}/cancel`);
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Campanhas</h1>
          <p className="text-xs text-gray-400">Disparos em massa pelo WhatsApp</p>
        </div>
        <Link to="/team" className="text-sm text-blue-600 hover:underline">← Voltar pra equipe</Link>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
            + Nova campanha
          </button>
        </div>

        <div className="bg-white border rounded-lg">
          {campaigns.map((c) => (
            <div key={c.id} className="px-4 py-3 border-b last:border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate max-w-md">{c.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
                  {(c.status === "SCHEDULED" || c.status === "SENDING") && (
                    <button onClick={() => cancel(c.id)} className="text-xs text-red-500 hover:text-red-700">Cancelar</button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>{c.total} contato(s)</span>
                <span className="text-green-600">{c.sent} enviada(s)</span>
                {c.failed > 0 && <span className="text-red-500">{c.failed} falhou(aram)</span>}
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-[160px]">
                  <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${c.total ? ((c.sent + c.failed) / c.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhuma campanha ainda.</p>}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-gray-800">Nova campanha</h2>
            <input placeholder='Nome (ex: "Promoção de sexta")' value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <textarea placeholder="Mensagem" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2 text-sm" required />
            <input
              placeholder="Tag dos contatos (ex: vip) — define a lista"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
            <div>
              <label className="text-xs text-gray-400">Horário do disparo (vazio = agora)</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Limite de envios por minuto</label>
              <input type="number" min={1} max={120} value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Criar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
