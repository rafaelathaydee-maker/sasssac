import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { ConversationList } from "../components/ConversationList";
import { ChatWindow } from "../components/ChatWindow";
import { ConversationActions } from "../components/ConversationActions";
import { AgentsPresence } from "../components/AgentsPresence";
import { ContactInfoPanel } from "../components/ContactInfoPanel";
import {
  Agent,
  QuickReply,
  Contact,
  ConversationFilter,
  ConversationListItem,
  ConversationPriority,
  ConversationStatus,
  ConversationSummary,
  Department,
  Message,
} from "../types";

const TABS: { key: ConversationFilter; label: string; countKey?: keyof ConversationSummary }[] = [
  { key: "mine", label: "Minhas conversas", countKey: "mine" },
  { key: "unassigned", label: "Sem responsável", countKey: "unassigned" },
  { key: "all", label: "Todas" },
];

function matchesFilter(item: { assignedUser: { id: string } | null }, filter: ConversationFilter, userId: string) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !item.assignedUser;
  return item.assignedUser?.id === userId;
}

export function Inbox() {
  const { user, company, token, logout, loading } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket(token ? { token } : null);

  const [filter, setFilter] = useState<ConversationFilter>("mine");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "">("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [viewerUserIds, setViewerUserIds] = useState<string[]>([]);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) navigate("/login");
  }, [loading, token, navigate]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (!token) return;
    api.get("/users").then(({ data }) => setAgents(data));
    api.get("/quick-replies").then(({ data }) => setQuickReplies(data));
  }, [token]);

  function refreshSummary() {
    api.get("/conversations/summary").then(({ data }) => setSummary(data));
  }
  useEffect(refreshSummary, [token]);

  function reloadConversations() {
    return api
      .get("/conversations", {
        params: {
          filter,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(filter === "all" && agentFilter ? { agentId: agentFilter } : {}),
          ...(departmentFilter ? { departmentId: departmentFilter } : {}),
          ...(search ? { search } : {}),
        },
      })
      .then(({ data }) => setConversations(data));
  }

  // recarrega a inbox sempre que aba/busca/filtros mudam (debounce simples pra busca)
  useEffect(() => {
    if (!token) return;
    const handle = setTimeout(() => {
      reloadConversations();
    }, 300);
    return () => clearTimeout(handle);
  }, [token, filter, statusFilter, agentFilter, departmentFilter, search]);

  useEffect(() => {
    if (!socket) return;
    function handlePresence(p: { userId: string; isOnline: boolean }) {
      setAgents((prev) => prev.map((a) => (a.id === p.userId ? { ...a, isOnline: p.isOnline } : a)));
    }
    socket.on("presence:update", handlePresence);
    return () => {
      socket.off("presence:update", handlePresence);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !user) return;
    const currentUser = user;

    function toConversationListItem(payload: any): ConversationListItem {
      return {
        id: payload.id || payload.conversationId,
        status: payload.status,
        contact: payload.contact,
        isPinned: payload.isPinned ?? false,
        isFavorite: payload.isFavorite ?? false,
        priority: payload.priority ?? "NORMAL",
        department: payload.department ?? null,
        assignedUser: payload.assignedUser ?? null,
        lastMessage: payload.lastMessage,
        updatedAt: new Date().toISOString(),
      };
    }

    function handleNewConversation(payload: any) {
      const item = toConversationListItem(payload);
      if (matchesFilter(item, filter, currentUser.id)) {
        setConversations((prev) => {
          const withoutDuplicate = prev.filter((c) => c.id !== item.id);
          return [item, ...withoutDuplicate];
        });
      } else {
        reloadConversations();
      }
      refreshSummary();
    }

    function handleConversationUpdated(payload: any) {
      if (!payload.contact) {
        setConversations((prev) => {
          if (!prev.some((c) => c.id === payload.conversationId)) {
            reloadConversations();
            return prev;
          }
          const updated = prev.map((c) =>
            c.id === payload.conversationId ? { ...c, lastMessage: payload.lastMessage } : c
          );
          return [...updated].sort((a, b) => {
            const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bt - at;
          });
        });
        refreshSummary();
        return;
      }
      const item: ConversationListItem = {
        ...toConversationListItem(payload),
        status: payload.status,
      };
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === item.id);
        if (!exists) {
          if (matchesFilter(item, filter, currentUser.id)) return [item, ...prev];
          reloadConversations();
          return prev;
        }
        const updated = prev.map((c) => (c.id === item.id ? { ...c, ...item } : c));
        return [...updated].sort((a, b) => {
          const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return bt - at;
        });
      });
      refreshSummary();
    }

    function handleMetaUpdated(payload: {
      conversationId: string;
      status: ConversationStatus;
      assignedUser: { id: string; name: string } | null;
      isPinned?: boolean;
      isFavorite?: boolean;
      priority?: ConversationPriority;
    }) {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === payload.conversationId);
        if (!exists) {
          if (matchesFilter({ assignedUser: payload.assignedUser }, filter, currentUser.id)) {
            api.get("/conversations", { params: { filter } }).then(({ data }) => setConversations(data));
          }
          return prev;
        }
        const updatedItem = {
          ...exists,
          status: payload.status,
          assignedUser: payload.assignedUser,
          ...(payload.isPinned !== undefined ? { isPinned: payload.isPinned } : {}),
          ...(payload.isFavorite !== undefined ? { isFavorite: payload.isFavorite } : {}),
          ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        };
        if (!matchesFilter(updatedItem, filter, currentUser.id)) {
          return prev.filter((c) => c.id !== payload.conversationId);
        }
        return prev.map((c) => (c.id === payload.conversationId ? updatedItem : c));
      });
      refreshSummary();
    }

    socket.on("conversation:new", handleNewConversation);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("conversation:meta_updated", handleMetaUpdated);
    return () => {
      socket.off("conversation:new", handleNewConversation);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("conversation:meta_updated", handleMetaUpdated);
    };
  }, [socket, filter, user]);

  // ao abrir uma conversa: histórico (1ª página) + entra na sala dela
  useEffect(() => {
    if (!selectedId || !socket) return;
    setViewerUserIds([]);
    setTypingLabel(null);

    api.get(`/conversations/${selectedId}/messages`).then(({ data }) => {
      setMessages(data.messages);
      setHasMoreOlder(data.hasMore);
    });
    socket.emit("conversation:join", { conversationId: selectedId });

    function handleNewMessage(message: Message) {
      if (message.conversationId !== selectedId) return;
      setMessages((prev) => [...prev, message]);
      setTypingLabel(null);
    }
    function handleViewers(payload: { conversationId: string; viewerUserIds: string[] }) {
      if (payload.conversationId !== selectedId) return;
      setViewerUserIds(payload.viewerUserIds);
    }
    function handleRead(payload: { conversationId: string; messageIds: string[]; readAt: string }) {
      if (payload.conversationId !== selectedId) return;
      setMessages((prev) =>
        prev.map((m) => (payload.messageIds.includes(m.id) ? { ...m, readAt: payload.readAt } : m))
      );
    }
    function handleTyping(payload: { conversationId: string; isTyping: boolean; from: { type: string } }) {
      if (payload.conversationId !== selectedId) return;
      if (!payload.isTyping) return setTypingLabel(null);
      setTypingLabel(payload.from.type === "CONTACT" ? "Cliente está digitando..." : "Colega está digitando...");
    }

    socket.on("message:new", handleNewMessage);
    socket.on("conversation:viewers", handleViewers);
    socket.on("message:read", handleRead);
    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:viewers", handleViewers);
      socket.off("message:read", handleRead);
      socket.off("typing:update", handleTyping);
      socket.emit("conversation:leave", { conversationId: selectedId });
    };
  }, [selectedId, socket]);

  async function handleLoadOlder() {
    if (!selectedId || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const { data } = await api.get(`/conversations/${selectedId}/messages`, {
        params: { before: messages[0].id },
      });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMoreOlder(data.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }

  const [uploading, setUploading] = useState(false);
  function handleSend(content: string, internal?: boolean) {
    if (!socket || !selectedId) return;
    socket.emit("message:send", { conversationId: selectedId, content, ...(internal ? { type: "INTERNAL" } : {}) });
  }
  async function handleSendMedia(file: File, caption: string) {
    if (!socket || !selectedId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
      socket.emit("message:send", {
        conversationId: selectedId,
        content: caption,
        type: data.type,
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.toString() || "Não foi possível enviar o arquivo");
    } finally {
      setUploading(false);
    }
  }
  function handleTypingStart() {
    if (socket && selectedId) socket.emit("typing:start", { conversationId: selectedId });
  }
  function handleTypingStop() {
    if (socket && selectedId) socket.emit("typing:stop", { conversationId: selectedId });
  }

  function handleClaim(id: string) {
    api.post(`/conversations/${id}/claim`).catch(console.error);
  }
  function handleRelease(id: string) {
    api.post(`/conversations/${id}/release`).catch(console.error);
  }
  function handleAssign(id: string, userId: string) {
    api.post(`/conversations/${id}/assign`, { userId }).catch(console.error);
  }
  function handleStatusChange(id: string, status: ConversationStatus) {
    api.patch(`/conversations/${id}/status`, { status }).catch(console.error);
  }
  function handleTogglePin(id: string, pinned: boolean) {
    api.post(`/conversations/${id}/${pinned ? "unpin" : "pin"}`).catch(console.error);
  }
  function handleToggleFavorite(id: string, favorite: boolean) {
    api.post(`/conversations/${id}/${favorite ? "unfavorite" : "favorite"}`).catch(console.error);
  }
  function handlePriorityChange(id: string, priority: ConversationPriority) {
    api.patch(`/conversations/${id}/priority`, { priority }).catch(console.error);
  }
  function handleContactUpdated(contact: Contact) {
    setConversations((prev) => prev.map((c) => (c.contact.id === contact.id ? { ...c, contact } : c)));
  }

  function handleAdminNavigation(path: string) {
    if (path) navigate(path);
  }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  return (
    <div className="flex h-screen gap-4 bg-slate-100 p-4 text-slate-900">
      <aside className="flex w-[360px] min-w-[320px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-gray-800">{company?.name}</p>
            <p className="text-xs text-gray-400">{user?.name}</p>
          </div>
          <div className="flex max-w-[220px] flex-wrap items-center justify-end gap-2">
            {user?.role === "ADMIN" && (
              <>
                <Link to="/chatbot" className="text-xs text-gray-400 hover:text-blue-600">Chatbot</Link>
                <Link to="/campaigns" className="text-xs text-gray-400 hover:text-blue-600">Campanhas</Link>
                <Link to="/crm" className="text-xs text-gray-400 hover:text-blue-600">CRM</Link>
                <Link to="/reports" className="text-xs text-gray-400 hover:text-blue-600">Relatórios</Link>
                <Link to="/audit" className="text-xs text-gray-400 hover:text-blue-600">Auditoria</Link>
                <Link to="/team" className="text-xs text-gray-400 hover:text-blue-600">
                  Equipe
                </Link>
              </>
            )}
            <button onClick={handleLogout} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              Sair
            </button>
          </div>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou mensagem..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 border-b border-slate-200 px-4 pb-3 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`relative rounded-md px-2 py-2 font-medium ${
                filter === t.key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {t.countKey && summary && summary[t.countKey] > 0 && (
                <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 px-1.5 rounded-full">
                  {summary[t.countKey]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-2 border-b border-slate-200 px-4 py-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | "")}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600"
          >
            <option value="">Todos os status</option>
            <option value="OPEN">Aberta</option>
            <option value="IN_PROGRESS">Em atendimento</option>
            <option value="RESOLVED">Resolvida</option>
          </select>
          {filter === "all" && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600"
            >
              <option value="">Todos os agentes</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600"
            >
              <option value="">Todos os deptos</option>
              <option value="mine">Meu departamento</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
        <AgentsPresence agents={agents} />
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {selectedConversation && user ? (
          <ChatWindow
            title={selectedConversation.contact.name}
            subtitle={selectedConversation.contact.email || selectedConversation.contact.phone || undefined}
            headerExtra={
              <ConversationActions
                conversation={selectedConversation}
                currentUserId={user.id}
                agents={agents}
                viewerUserIds={viewerUserIds}
                onClaim={() => handleClaim(selectedConversation.id)}
                onRelease={() => handleRelease(selectedConversation.id)}
                onAssign={(userId) => handleAssign(selectedConversation.id, userId)}
                onStatusChange={(status) => handleStatusChange(selectedConversation.id, status)}
                onTogglePin={() => handleTogglePin(selectedConversation.id, selectedConversation.isPinned)}
                onToggleFavorite={() => handleToggleFavorite(selectedConversation.id, selectedConversation.isFavorite)}
                onPriorityChange={(priority) => handlePriorityChange(selectedConversation.id, priority)}
              />
            }
            messages={messages}
            viewerType="USER"
            onSend={handleSend}
            onSendMedia={handleSendMedia}
            allowInternalNotes
            uploading={uploading}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={handleLoadOlder}
            typingLabel={typingLabel}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            quickReplies={quickReplies}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Selecione uma conversa para começar
          </div>
        )}
      </main>

      {selectedConversation && (
        <ContactInfoPanel contact={selectedConversation.contact} onUpdated={handleContactUpdated} />
      )}
    </div>
  );
}
