import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";

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
