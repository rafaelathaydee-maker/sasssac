import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Message, QuickReply, SenderType } from "../types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode; // ações de atendimento (claim/release/status) — só usado pelo painel do agente
  messages: Message[];
  viewerType: SenderType; // de qual lado estamos olhando esse chat (define a bolha "própria")
  onSend: (content: string, internal?: boolean) => void;
  allowInternalNotes?: boolean;
  onSendMedia?: (file: File, caption: string) => Promise<void> | void;
  disabled?: boolean;
  uploading?: boolean;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void | Promise<void>;
  typingLabel?: string | null;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  quickReplies?: QuickReply[];
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDay(messages: Message[]) {
  const groups: { key: string; messages: Message[] }[] = [];
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.messages.push(m);
    else groups.push({ key, messages: [m] });
  }
  return groups;
}

export function ChatWindow({
  title,
  subtitle,
  headerExtra,
  messages,
  viewerType,
  onSend,
  onSendMedia,
  allowInternalNotes,
  disabled,
  uploading,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  typingLabel,
  onTypingStart,
  onTypingStop,
  quickReplies = [],
}: Props) {
  const [draft, setDraft] = useState("");
  const [qrSuggestions, setQrSuggestions] = useState<QuickReply[]>([]);
  const [internalMode, setInternalMode] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  function pickFile(file: File) {
    setPendingFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setPendingPreviewUrl(URL.createObjectURL(file));
    } else {
      setPendingPreviewUrl(null);
    }
  }
  function cancelPendingFile() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }
  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(() => groupByDay(messages), [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isPrependingRef.current) {
      // preserva a posição visual depois de carregar mensagens antigas no topo
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      isPrependingRef.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  async function handleLoadOlder() {
    if (!onLoadOlder || !containerRef.current) return;
    prevScrollHeightRef.current = containerRef.current.scrollHeight;
    isPrependingRef.current = true;
    await onLoadOlder();
  }

  function notifyTyping() {
    if (!onTypingStart || !onTypingStop) return;
    onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingStop(), 1800);
  }

  function applyQuickReply(q: QuickReply) {
    setDraft(q.message);
    setQrSuggestions([]);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const match = value.match(/^\/(\S*)$/);
    if (match && quickReplies.length) {
      const term = match[1].toLowerCase();
      setQrSuggestions(quickReplies.filter((q) => q.shortcut.toLowerCase().startsWith(term)));
    } else {
      setQrSuggestions([]);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();

    if (pendingFile) {
      const file = pendingFile;
      cancelPendingFile();
      setDraft("");
      await onSendMedia?.(file, content);
      return;
    }

    if (!content) return;
    onSend(content, internalMode);
    setDraft("");
    setQrSuggestions([]);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTypingStop?.();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
        {headerExtra && <div className="flex-shrink-0">{headerExtra}</div>}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-50 px-4 py-3">
        {hasMoreOlder && (
          <div className="flex justify-center mb-3">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="text-xs px-3 py-1.5 rounded-full border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {loadingOlder ? "Carregando..." : "Carregar mensagens antigas"}
            </button>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] text-gray-400 bg-gray-200/70 px-3 py-1 rounded-full">
                {dayLabel(group.messages[0].createdAt)}
              </span>
            </div>
            {group.messages.map((m) => (
              <MessageBubble key={m.id} message={m} own={m.senderType === viewerType} />
            ))}
          </div>
        ))}

        {typingLabel && (
          <div className="flex items-center gap-1 text-xs text-gray-400 italic mt-1 mb-2">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
            </span>
            {typingLabel}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {pendingFile && (
        <div className="border-t bg-gray-50 px-3 pt-3 flex items-center gap-3">
          {pendingPreviewUrl && pendingFile.type.startsWith("image/") && (
            <img src={pendingPreviewUrl} alt="" className="w-14 h-14 object-cover rounded-lg border" />
          )}
          {pendingPreviewUrl && pendingFile.type.startsWith("video/") && (
            <video src={pendingPreviewUrl} className="w-14 h-14 object-cover rounded-lg border" />
          )}
          {!pendingPreviewUrl && (
            <div className="w-14 h-14 flex items-center justify-center rounded-lg border bg-white text-xl">📄</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{pendingFile.name}</p>
            <p className="text-xs text-gray-400">{formatFileSize(pendingFile.size)}</p>
          </div>
          <button type="button" onClick={cancelPendingFile} className="text-gray-400 hover:text-red-500 text-lg px-2">
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`border-t p-3 flex gap-2 ${internalMode ? "bg-amber-50" : "bg-white"}`}>
        {allowInternalNotes && !pendingFile && (
          <button
            type="button"
            onClick={() => setInternalMode((v) => !v)}
            title="Nota interna (só agentes veem)"
            className={`flex items-center justify-center w-9 h-9 rounded-full border flex-shrink-0 ${
              internalMode ? "bg-amber-400 text-white border-amber-400" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            🔒
          </button>
        )}
        {onSendMedia && !pendingFile && (
          <>
            <input
              type="file"
              id="chat-file-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="chat-file-input"
              className="flex items-center justify-center w-9 h-9 rounded-full border text-gray-500 cursor-pointer hover:bg-gray-50 flex-shrink-0"
              title="Enviar arquivo"
            >
              {uploading ? "…" : "📎"}
            </label>
          </>
        )}
        <div className="relative flex-1">
          {qrSuggestions.length > 0 && (
            <ul className="absolute bottom-full mb-1 w-full bg-white border rounded-lg shadow-md max-h-40 overflow-y-auto z-10">
              {qrSuggestions.map((q) => (
                <li
                  key={q.id}
                  onClick={() => applyQuickReply(q)}
                  className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                >
                  <span className="text-blue-600">/{q.shortcut}</span> — {q.title}
                </li>
              ))}
            </ul>
          )}
          <input
            value={draft}
            onChange={(e) => {
              handleDraftChange(e.target.value);
              notifyTyping();
            }}
            placeholder={pendingFile ? "Adicionar legenda (opcional)..." : internalMode ? "Nota interna — só agentes veem..." : "Digite sua mensagem... (/ pra respostas rápidas)"}
            disabled={disabled}
            className="w-full border rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="bg-blue-600 text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
