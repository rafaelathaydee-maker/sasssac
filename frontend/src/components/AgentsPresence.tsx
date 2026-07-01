import { Agent } from "../types";

export function AgentsPresence({ agents }: { agents: Agent[] }) {
  const active = agents.filter((a) => a.isActive);
  if (active.length === 0) return null;

  return (
    <div className="border-t px-4 py-3">
      <p className="text-[11px] font-medium text-gray-400 uppercase mb-2">Equipe</p>
      <ul className="space-y-1.5">
        {active.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${a.isOnline ? "bg-green-500" : "bg-gray-300"}`}
              title={a.isOnline ? "Online" : "Offline"}
            />
            <span className="truncate">{a.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
