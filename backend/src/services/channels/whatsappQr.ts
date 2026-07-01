import path from "path";
import QRCode from "qrcode";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
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
  socket: WASocket | null;
};

const sessions = new Map<string, Session>();

function sessionDir(companyId: string) {
  return path.join(process.cwd(), ".whatsapp-sessions", companyId.replace(/[^a-zA-Z0-9_-]/g, ""));
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
  };
}

export async function startWhatsappQrSession(companyId: string) {
  const existing = sessions.get(companyId);
  if (existing?.status === "connected" || existing?.status === "qr" || existing?.status === "connecting") {
    return getWhatsappQrStatus(companyId);
  }

  const session: Session = { companyId, status: "connecting", qrDataUrl: null, jid: null, socket: null };
  sessions.set(companyId, session);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(companyId));
  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({ auth: state, version, printQRInTerminal: false });
  session.socket = socket;

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
    }
    if (update.connection === "open") {
      session.status = "connected";
      session.qrDataUrl = null;
      session.jid = socket.user?.id || null;
      await prisma.channelConfig.upsert({
        where: { companyId_channel: { companyId, channel: "WHATSAPP" } },
        update: { externalAccountId: session.jid, credentials: { mode: "QR" }, isActive: true },
        create: { companyId, channel: "WHATSAPP", externalAccountId: session.jid, credentials: { mode: "QR" } },
      });
    }
    if (update.connection === "close") {
      const code = (update.lastDisconnect?.error as any)?.output?.statusCode;
      session.status = "disconnected";
      session.socket = null;
      if (code !== DisconnectReason.loggedOut) {
        sessions.delete(companyId);
      }
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
