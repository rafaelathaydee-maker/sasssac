import { Agent, ConversationListItem, ConversationPriority, ConversationStatus } from "../types";

interface Props {
  conversation: ConversationListItem;
  currentUserId: string;
  agents: Agent[];
  viewerUserIds: string[];
  onClaim: () => void;
  onRelease: () => void;
  onAssign: (userId: string) => void;
  onStatusChange: (status: ConversationStatus) => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onPriorityChange: (priority: ConversationPriority) => void;
}

const statusLabel: Record<ConversationStatus, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em atendimento",
  RESOLVED: "Resolvida",
};

const statusColor: Record<ConversationStatus, string> = {
  OPEN: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  RESOLVED: "bg-gray-100 text-gray-500 border-gray-200",
};

const priorityLabel: Record<ConversationPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const priorityColor: Record<ConversationPriority, string> = {
  LOW: "bg-gray-100 text-gray-500 border-gray-200",
  NORMAL: "bg-white text-gray-500 border-gray-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  URGENT: "bg-red-100 text-red-700 border-red-200",
};

export function ConversationActions({
  conversation,
  currentUserId,
  agents,
  viewerUserIds,
  onClaim,
  onRelease,
  onAssign,
  onStatusChange,
  onTogglePin,
  onToggleFavorite,
  onPriorityChange,
}: Props) {
  const isMine = conversation.assignedUser?.id === currentUserId;
  const otherViewers = agents.filter((a) => viewerUserIds.includes(a.id) && a.id !== currentUserId);

  return (
    <div className="flex flex-col items-end gap-1.5 text-right">
      <div className="flex items-center gap-2">
        <button onClick={onTogglePin} title="Fixar conversa" className={`text-sm ${conversation.isPinned ? "" : "opacity-40"}`}>
          📌
        </button>
        <button onClick={onToggleFavorite} title="Favoritar conversa" className={`text-sm ${conversation.isFavorite ? "" : "opacity-40"}`}>
          ⭐
        </button>
        <select
          value={conversation.priority}
          onChange={(e) => onPriorityChange(e.target.value as ConversationPriority)}
          className={`text-xs px-1.5 py-1 rounded-md border font-medium ${priorityColor[conversation.priority]}`}
        >
          {Object.keys(priorityLabel).map((p) => (
            <option key={p} value={p}>
              {priorityLabel[p as ConversationPriority]}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          {conversation.department && (
            <span className="bg-gray-100 rounded-full px-1.5 mr-1">{conversation.department.name}</span>
          )}
          {conversation.assignedUser ? (
            <>
              Responsável: <span className="font-medium text-gray-700">{conversation.assignedUser.name}</span>
            </>
          ) : (
            <span className="text-orange-500 font-medium">Sem responsável</span>
          )}
        </span>

        {isMine ? (
          <button onClick={onRelease} className="text-xs px-2 py-1 rounded-md border hover:bg-gray-50">
            Soltar
          </button>
        ) : (
          <button
            onClick={onClaim}
            className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Pegar conversa
          </button>
        )}

        <select
          value=""
          onChange={(e) => e.target.value && onAssign(e.target.value)}
          className="text-xs border rounded-md px-1.5 py-1 text-gray-600"
        >
          <option value="">Transferir para...</option>
          {agents
            .filter((a) => a.isActive && a.id !== conversation.assignedUser?.id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isOnline ? "🟢" : "⚪"}
              </option>
            ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        {otherViewers.length > 0 && (
          <span className="text-[11px] text-gray-400">
            👀 {otherViewers.map((a) => a.name).join(", ")} também {otherViewers.length > 1 ? "estão" : "está"} vendo
          </span>
        )}

        <select
          value={conversation.status}
          onChange={(e) => onStatusChange(e.target.value as ConversationStatus)}
          className={`text-xs px-2 py-1 rounded-full border font-medium ${statusColor[conversation.status]}`}
        >
          {Object.keys(statusLabel).map((s) => (
            <option key={s} value={s}>
              {statusLabel[s as ConversationStatus]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
