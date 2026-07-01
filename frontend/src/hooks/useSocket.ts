import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../api/client";

export type SocketAuth = { token: string } | { conversationId: string; contactId: string };

/**
 * Cria/mantém uma única conexão de socket enquanto `auth` for válido.
 * Reconecta automaticamente se `auth` mudar (ex: trocou de usuário).
 */
export function useSocket(auth: SocketAuth | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!auth) {
      setSocket(null);
      return;
    }

    const s = io(API_URL, { auth, autoConnect: true });
    setSocket(s);

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(auth)]);

  return socket;
}
