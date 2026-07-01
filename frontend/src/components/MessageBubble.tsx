import { Message } from "../types";
import { API_URL } from "../api/client";

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaContent({ message }: { message: Message }) {
  if (!message.mediaUrl) return null;
  const url = message.mediaUrl.startsWith("http") ? message.mediaUrl : `${API_URL}${message.mediaUrl}`;

  if (message.type === "IMAGE") {
    return <img src={url} alt={message.fileName || ""} className="rounded-lg max-w-full max-h-60 mb-1" />;
  }
  if (message.type === "VIDEO") {
    return <video src={url} controls className="rounded-lg max-w-full max-h-60 mb-1" />;
  }
  if (message.type === "AUDIO") {
    return <audio src={url} controls className="mb-1 max-w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2 mb-1 hover:bg-black/10">
      <span>📄</span>
      <span className="text-sm truncate">{message.fileName || "Arquivo"}</span>
      <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(message.fileSize)}</span>
    </a>
  );
}

function ReadTicks({ read }: { read: boolean }) {
  // ✓ enviada (cinza) / ✓✓ lida (azul) — igual ao padrão que todo mundo já reconhece
  return (
    <svg viewBox="0 0 16 10" className={`inline-block w-3.5 h-2.5 ml-1 ${read ? "text-sky-300" : "text-blue-100/70"}`}>
      <path
        d="M1 5.5L4 8.5L9.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {read && (
        <path
          d="M6 5.5L9 8.5L14.5 1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function MessageBubble({ message, own }: { message: Message; own: boolean }) {
  const isSystem = message.senderType === "SYSTEM";

  if (isSystem) {
    return <div className="text-center text-xs text-gray-400 my-2">{message.content}</div>;
  }

  if (message.type === "INTERNAL") {
    return (
      <div className="my-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="text-[10px] font-medium text-amber-600 mb-0.5">🔒 Nota interna</p>
        <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">{message.content}</p>
        <span className="block text-[10px] text-amber-500 mt-1">
          {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          own ? "bg-blue-600 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border"
        }`}
      >
        <MediaContent message={message} />
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
        <span className={`flex items-center justify-end text-[10px] mt-1 ${own ? "text-blue-100" : "text-gray-400"}`}>
          {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {own && <ReadTicks read={!!message.readAt} />}
        </span>
      </div>
    </div>
  );
}
