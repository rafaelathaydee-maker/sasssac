import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Agent } from "../types";

interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: any;
  createdAt: string;
}

function describe(log: AuditLog, agentsById: Record<string, string>) {
  const actor = (log.actorUserId && agentsById[log.actorUserId]) || "Alguém";
  const map: Record<string, string> = {
    "conversation.claim": `${actor} pegou uma conversa`,
    "conversation.release": `${actor} soltou uma conversa`,
    "conversation.assign": `${actor} transferiu uma conversa`,
    "contact.update": `${actor} alterou um cliente`,
    "user.create": `${actor} criou um agente`,
    "user.update": `${actor} alterou um agente`,
    "user.delete": `${actor} removeu um agente`,
    "user.reset_password": `${actor} resetou a senha de um agente`,
    "company.settings.update": `${actor} alterou configurações da empresa`,
    "company.branding.update": `${actor} alterou a personalização do widget`,
    "company.plan.change": `${actor} trocou o plano da empresa`,
    "channel.whatsapp.connect": `${actor} conectou o WhatsApp`,
    "department.create": `${actor} criou um departamento`,
    "department.update": `${actor} alterou um departamento`,
    "department.delete": `${actor} excluiu um departamento`,
    "department.agent.add": `${actor} adicionou um agente a um departamento`,
    "department.agent.remove": `${actor} removeu um agente de um departamento`,
    "chatbot.flow.create": `${actor} criou um fluxo de chatbot`,
    "chatbot.flow.update": `${actor} editou um fluxo de chatbot`,
    "chatbot.flow.delete": `${actor} excluiu um fluxo de chatbot`,
    "campaign.create": `${actor} criou uma campanha`,
    "campaign.cancel": `${actor} cancelou uma campanha`,
    "crm.stage.update": `${actor} moveu um cliente no funil`,
  };
  return map[log.action] || `${actor} fez uma ação (${log.action})`;
}

export function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [agentsById, setAgentsById] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get("/users").then(({ data }: { data: Agent[] }) => {
      const map: Record<string, string> = {};
      data.forEach((a) => (map[a.id] = a.name));
      setAgentsById(map);
    });
    api.get("/company/audit-logs").then(({ data }) => setLogs(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-800">Auditoria</h1>
          <p className="text-xs text-gray-400">Quem fez o quê na sua empresa</p>
        </div>
        <Link to="/inbox" className="text-sm text-blue-600 hover:underline">← Voltar pra inbox</Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border rounded-lg divide-y">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-700">{describe(log, agentsById)}</span>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                {new Date(log.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
          {logs.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhuma ação registrada ainda.</p>}
        </div>
      </main>
    </div>
  );
}
