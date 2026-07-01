import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { sendWhatsappQrMessage } from "../services/channels/whatsappQr";
import { isEvolutionEnabled, sendEvolutionWhatsappMessage } from "../services/channels/evolutionProvider";

let io: Server | null = null;

export function initSocket(server: HttpServer, corsOrigin: string) {
  io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token nao informado"));
    try {
      const auth = verifyToken(token);
      socket.data.auth = auth;
      socket.join(`company:${auth.companyId}`);
      socket.join(`user:${auth.userId}`);
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket conectado");

    socket.on("conversation:join", ({ conversationId }: { conversationId?: string }) => {
      if (conversationId) socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", ({ conversationId }: { conversationId?: string }) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", ({ conversationId }: { conversationId?: string }) => {
      if (conversationId) socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, isTyping: true, from: { type: "USER" } });
    });

    socket.on("typing:stop", ({ conversationId }: { conversationId?: string }) => {
      if (conversationId) socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, isTyping: false, from: { type: "USER" } });
    });

    socket.on("message:send", async (payload: { conversationId?: string; content?: string; type?: string; mediaUrl?: string; fileName?: string; mimeType?: string; fileSize?: number }) => {
      const auth = socket.data.auth;
      const conversationId = payload.conversationId;
      const content = payload.content?.trim();
      if (!auth?.companyId || !auth?.userId || !conversationId || !content) return;

      try {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, companyId: auth.companyId },
          include: { contact: true },
        });
        if (!conversation) return;

        const saved = await prisma.message.create({
          data: {
            conversationId,
            userId: auth.userId,
            senderType: payload.type === "INTERNAL" ? "SYSTEM" : "USER",
            direction: payload.type === "INTERNAL" ? "INBOUND" : "OUTBOUND",
            content,
            type: payload.type === "INTERNAL" ? "INTERNAL" : ((payload.type as any) || "TEXT"),
            mediaUrl: payload.mediaUrl,
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            fileSize: payload.fileSize,
          },
        });

        await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: saved.createdAt } });

        if (conversation.channel === "WHATSAPP" && conversation.externalId && payload.type !== "INTERNAL") {
          if (isEvolutionEnabled()) await sendEvolutionWhatsappMessage(auth.companyId, conversation.externalId, content);
          else await sendWhatsappQrMessage(auth.companyId, conversation.externalId, content);
        }

        io!.to(`conversation:${conversationId}`).emit("message:new", saved);
        io!.to(`company:${auth.companyId}`).emit("conversation:updated", { conversationId, lastMessage: saved });
      } catch (err) {
        logger.error({ err, conversationId }, "Erro ao enviar mensagem");
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    return {
      to: () => ({ emit: () => undefined }),
      emit: () => undefined,
    } as unknown as Server;
  }
  return io;
}
