import path from "path";
import os from "os";
import QRCode from "qrcode";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getIO } from "../../realtime/socket";

type SessionStatus = "idle" | "connecting" | "qr" | "connected" | "disconnected";

type Session = {
  companyId: string;
  status: SessionStatus;
  qrDataUrl: string | null;
  jid: string | null;
  lastError: string | null;
  socket: WASocket | null;
};

const sessions = new Map<string, Session>();

function sessionDir(companyId: string) {
  const root = process.env.WHATSAPP_SESSION_DIR || path.join(os.tmpdir(), "sasssac-whatsapp-sessions");
  return path.join(root, companyId.replace(/[^a-zA-Z0-9_-]/g, ""));
}

function getText(message: any) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}

async function processIncomingMessage(companyId: string, message: any) {
  if (!message.message || message.key.fromMe) return;
  const remoteJid = message.key.remoteJid as string | undefined;
  if (!remoteJid || remoteJid === "status@broadcast") return;

  const content = getText(message.message);
  if (!content.trim()) return;

  const phone = remoteJid.split("@")[0];
  const contact =
    (await prisma.contact.findFirst({ where: { companyId, phone } })) ||
    (await prisma.contact.create({
      data: { companyId, phone, name: message.pushName || phone },
    }));

  let conversation = await prisma.conversation.findFirst({
    where: { companyId, channel: "WHATSAPP", externalId: remoteJid, status: { not: "RESOLVED" } },
    include: { assignedUser: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        companyId,
        contactId: contact.id,
        channel: "WHATSAPP",
        externalId: remoteJid,
        lastMessageAt: new Date(),
      },
      include: { assignedUser: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
    });
  }

  const saved = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      contactId: contact.id,
      senderType: "CONTACT",
      direction: "INBOUND",
      channelMessageId: message.key.id,
      content,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: saved.createdAt },
  });

  const io = getIO();
  io.to(`company:${companyId}`).emit("conversation:new", {
    id: conversation.id,
    status: conversation.status,
    contact,
    assignedUser: conversation.assignedUser,
    department: conversation.department,
    lastMessage: saved,
  });
  io.to(`conversation:${conversation.id}`).emit("message:new", saved);
}

export function getWhatsappQrStatus(companyId: string) {
  const session = sessions.get(companyId);
  return {
    status: session?.status || "idle",
    qrDataUrl: session?.qrDataUrl || null,
    jid: session?.jid || null,
    lastError: session?.lastError || null,
  };
}

export async function startWhatsappQrSession(companyId: string) {
  const existing = sessions.get(companyId);
  if (existing?.status === "connected" || existing?.status === "connecting") {
    return getWhatsappQrStatus(companyId);
  }
  if (existing) await stopWhatsappQrSession(companyId);

  const session: Session = { companyId, status: "connecting", qrDataUrl: null, jid: null, lastError: null, socket: null };
  sessions.set(companyId, session);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(companyId));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1023204200] as [number, number, number] }));
  const socket = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    version,
    browser: Browsers.macOS("Sasssac"),
    connectTimeoutMs: 60_000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    printQRInTerminal: false,
  });
  session.socket = socket;

  const qrTimeout = setTimeout(() => {
    if (session.status === "connecting") {
      session.status = "disconnected";
      session.lastError = "Nao foi possivel gerar o QR Code. Tente novamente.";
      session.socket?.end(undefined);
    }
  }, 45_000);

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      await processIncomingMessage(companyId, message).catch((err) => logger.error({ err }, "Erro ao importar mensagem WhatsApp QR"));
    }
  });
  socket.ev.on("connection.update", async (update) => {
    if (update.qr) {
      session.status = "qr";
      session.qrDataUrl = await QRCode.toDataURL(update.qr);
      session.lastError = null;
    }
    if (update.connection === "open") {
      clearTimeout(qrTimeout);
      session.status = "connected";
      session.qrDataUrl = null;
      session.jid = socket.user?.id || null;
      session.lastError = null;
      await prisma.channelConfig.upsert({
        where: { companyId_channel: { companyId, channel: "WHATSAPP" } },
        update: { externalAccountId: session.jid, credentials: { mode: "QR" }, isActive: true },
        create: { companyId, channel: "WHATSAPP", externalAccountId: session.jid, credentials: { mode: "QR" } },
      });
      logger.info({ companyId, jid: session.jid }, "WhatsApp QR conectado");
    }
    if (update.connection === "close") {
      clearTimeout(qrTimeout);
      const code = (update.lastDisconnect?.error as any)?.output?.statusCode;
      session.status = "disconnected";
      session.socket = null;
      logger.warn({ companyId, code }, "WhatsApp QR fechou conexao");
      if (code === DisconnectReason.loggedOut) {
        session.lastError = "WhatsApp desconectado pelo celular.";
        return;
      }
      session.status = "connecting";
      session.lastError = "WhatsApp pediu reconexao. Tentando novamente...";
      setTimeout(() => {
        sessions.delete(companyId);
        startWhatsappQrSession(companyId).catch((err) => {
          logger.error({ err, companyId }, "Erro ao reconectar WhatsApp QR");
          const failed = sessions.get(companyId);
          if (failed) {
            failed.status = "disconnected";
            failed.lastError = "Falha ao reconectar. Gere um novo QR Code.";
          }
        });
      }, 1500);
    }
  });

  return getWhatsappQrStatus(companyId);
}

export async function stopWhatsappQrSession(companyId: string) {
  const session = sessions.get(companyId);
  await session?.socket?.logout().catch(() => undefined);
  sessions.delete(companyId);
}

export async function sendWhatsappQrMessage(companyId: string, remoteJid: string, content: string) {
  let session = sessions.get(companyId);
  if (!session || session.status !== "connected" || !session.socket) {
    await startWhatsappQrSession(companyId);
    session = sessions.get(companyId);
  }
  if (!session?.socket || session.status !== "connected") {
    throw new Error("WhatsApp QR nao esta conectado");
  }
  return session.socket.sendMessage(remoteJid, { text: content });
}
