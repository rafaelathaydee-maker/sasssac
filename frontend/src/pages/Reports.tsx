import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface AgentRow {
  agentId: string;
  agentName: string;
  totalConversations: number;
  resolvedCount: number;
  avgResolutionMinutes: number | null;
  avgRating: number | null;
  ratingCount: number;
}
interface ChannelRow {
  channel: string;
  conversations: number;
  messages: number;
}
interface PeakData {
  byHour: number[];
  peakHour: number;
  totalMessages: number;
}

const channelLabel: Record<string, string> = { WEBCHAT: "Webchat", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

function formatMinutes(min: number | null) {
  if (min === null) return "—";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

export function Reports() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [peak, setPeak] = useState<PeakData | null>(null);

  useEffect(() => {
    api.get("/reports/agents").then(({ data }) => setAgents(data));
    api.get("/reports/channels").then(({ data }) => setChannels(data));
    api.get("/reports/peak-hours").then(({ data }) => setPeak(data));
  }, []);

  const maxHourCount = peak ? Math.max(...peak.byHour, 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Relatórios</h1>
          <p className="text-xs text-gray-400">Desempenho da equipe e dos canais</p>
        </div>
        <Link to="/inbox" className="text-sm text-blue-600 hover:underline">← Voltar pra inbox</Link>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <section className="bg-white border rounded-lg">
          <p className="text-sm font-medium text-gray-700 px-4 py-3 border-b">Por agente</p>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2">Agente</th>
                <th className="text-left px-4 py-2">Atendimentos</th>
                <th className="text-left px-4 py-2">Resolvidos</th>
                <th className="text-left px-4 py-2">Tempo médio</th>
                <th className="text-left px-4 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agentId} className="border-t">
                  <td className="px-4 py-2">{a.agentName}</td>
                  <td className="px-4 py-2">{a.totalConversations}</td>
                  <td className="px-4 py-2">{a.resolvedCount}</td>
                  <td className="px-4 py-2">{formatMinutes(a.avgResolutionMinutes)}</td>
                  <td className="px-4 py-2">
                    {a.avgRating !== null ? `⭐ ${a.avgRating} (${a.ratingCount})` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Por canal</p>
          <div className="grid grid-cols-3 gap-4">
            {channels.map((c) => (
              <div key={c.channel} className="border rounded-md p-3 text-center">
                <p className="text-xs text-gray-400">{channelLabel[c.channel]}</p>
                <p className="text-xl font-semibold text-gray-800">{c.conversations}</p>
                <p className="text-xs text-gray-400">{c.messages} mensagens</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Horário de pico (últimos 30 dias)</p>
          {peak && (
            <>
              <p className="text-xs text-gray-400 mb-3">
                Pico às <strong>{peak.peakHour}h</strong> — {peak.totalMessages} mensagens no período
              </p>
              <div className="flex items-end gap-0.5 h-32">
                {peak.byHour.map((count, hour) => (
                  <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full" title={`${hour}h: ${count}`}>
                    <div
                      className={`w-full rounded-t ${hour === peak.peakHour ? "bg-blue-600" : "bg-blue-200"}`}
                      style={{ height: `${(count / maxHourCount) * 100}%`, minHeight: count > 0 ? 2 : 0 }}
                    />
                    {hour % 3 === 0 && <span className="text-[9px] text-gray-400 mt-0.5">{hour}h</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
