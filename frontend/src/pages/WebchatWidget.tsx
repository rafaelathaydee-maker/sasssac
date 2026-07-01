import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";
import { ChatWindow } from "../components/ChatWindow";
import { Message } from "../types";

interface Branding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string;
  offlineMessage: string;
  isOnline: boolean;
}

export function WebchatWidget() {
  const { slug } = useParams<{ slug: string }>();

  const [branding, setBranding] = useState<Branding | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const socket = useSocket(conversationId && contactId ? { conversationId, contactId } : null);

  useEffect(() => {
    api.get(`/public/${slug}/branding`).then(({ data }) => setBranding(data)).catch(() => setBranding(null));
    api.get(`/public/${slug}/departments`).then(({ data }) => setDepartments(data)).catch(() => setDepartments([]));
  }, [slug]);

  useEffect(() => {
    if (!socket) return;
    function handleNewMessage(message: Message) {
      setMessages((prev) => [...prev, message]);
    }
    socket.on("message:new", handleNewMessage);

    function handleMeta(payload: { status?: string }) {
      if (payload.status === "RESOLVED") setResolved(true);
    }
    socket.on("conversation:meta_updated", handleMeta);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:meta_updated", handleMeta);
    };
  }, [socket]);

  async function sendRating(stars: number) {
    if (!conversationId) return;
    await api.post(`/public/conversations/${conversationId}/rating`, { rating: stars }).catch(() => null);
    setRatingSent(true);
  }

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const { data } = await api.post(`/public/${slug}/conversations`, {
        name,
        email: email || undefined,
        message: firstMessage,
        departmentId: departmentId || undefined,
      });
      setConversationId(data.conversationId);
      setContactId(data.contactId);
      setMessages([data.message]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.toString() || "Não foi possível iniciar o chat. Verifique o slug da empresa.");
    } finally {
      setStarting(false);
    }
  }

  const [uploading, setUploading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [ratingSent, setRatingSent] = useState(false);
  function handleSend(content: string) {
    if (!socket || !conversationId) return;
    socket.emit("message:send", { conversationId, content });
  }
  async function handleSendMedia(file: File, caption: string) {
    if (!socket || !conversationId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/public/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
      socket.emit("message:send", {
        conversationId,
        content: caption,
        type: data.type,
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      });
    } catch {
      alert("Não foi possível enviar o arquivo");
    } finally {
      setUploading(false);
    }
  }

  const color = branding?.primaryColor || "#2563eb";
  const displayName = branding?.name || slug || "Atendimento";

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form
          onSubmit={handleStart}
          className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            {branding?.logoUrl && <img src={branding.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <h1 className="text-lg font-semibold text-gray-800">{displayName}</h1>
          </div>
          <p className="text-sm text-gray-600 mb-2">{branding?.welcomeMessage || "Olá! Como podemos ajudar?"}</p>

          {branding && !branding.isOnline && (
            <p className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md p-2">
              {branding.offlineMessage}
            </p>
          )}

          <input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            placeholder="Seu e-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {departments.length > 0 && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecione um assunto (opcional)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            placeholder="Como podemos ajudar?"
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={3}
            required
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={starting}
            style={{ backgroundColor: color }}
            className="w-full text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {starting ? "Iniciando..." : "Iniciar conversa"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md h-[600px] bg-white shadow-xl rounded-xl overflow-hidden">
        <ChatWindow
          title={displayName}
          subtitle="Normalmente respondemos em poucos minutos"
          messages={messages}
          viewerType="CONTACT"
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          uploading={uploading}
        />
        {resolved && !ratingSent && (
          <div className="border-t bg-gray-50 px-4 py-3 text-center">
            <p className="text-sm text-gray-600 mb-2">Como foi o atendimento?</p>
            <div className="flex justify-center gap-1 text-2xl">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => sendRating(s)} className="hover:scale-110 transition-transform">
                  ⭐
                </button>
              ))}
            </div>
          </div>
        )}
        {ratingSent && (
          <div className="border-t bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
            Obrigado pela avaliação! 🙌
          </div>
        )}
      </div>
    </div>
  );
}
