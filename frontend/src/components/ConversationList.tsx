import { ConversationListItem } from "../types";

interface Props {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusColor: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-gray-100 text-gray-500",
};

const statusLabel: Record<string, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em atendimento",
  RESOLVED: "Resolvida",
};

const priorityDot: Record<string, string> = {
  LOW: "bg-gray-300",
  NORMAL: "",
  HIGH: "bg-orange-400",
  URGENT: "bg-red-500",
};

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return <p className="p-4 text-sm text-gray-400">Nenhuma conversa aqui.</p>;
  }

  return (
    <ul className="overflow-y-auto flex-1">
      {conversations.map((c) => (
        <li
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`cursor-pointer px-4 py-3 border-b hover:bg-gray-50 ${
            selectedId === c.id ? "bg-blue-50" : ""
          } ${c.isPinned ? "bg-yellow-50/60" : ""}`}
        >
          <div className="flex justify-between items-center gap-2">
            <span className="font-medium text-sm text-gray-800 truncate flex items-center gap-1">
              {c.isPinned && <span title="Fixada">📌</span>}
              {c.isFavorite && <span title="Favorita">⭐</span>}
              {priorityDot[c.priority] && (
                <span className={`w-2 h-2 rounded-full ${priorityDot[c.priority]}`} title={`Prioridade ${c.priority}`} />
              )}
              {c.contact.name}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[c.status]}`}>
              {statusLabel[c.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-1">
            {c.lastMessage ? c.lastMessage.content : "Sem mensagens"}
          </p>
          <p className="text-[11px] mt-1 flex items-center gap-1.5">
            {c.assignedUser ? (
              <span className="text-gray-400">com {c.assignedUser.name}</span>
            ) : (
              <span className="text-orange-500 font-medium">Sem responsável</span>
            )}
            {c.department && (
              <span className="text-gray-400 bg-gray-100 rounded-full px-1.5">{c.department.name}</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
