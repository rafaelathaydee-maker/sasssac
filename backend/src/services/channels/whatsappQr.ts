import QRCode from "qrcode";
import makeWASocket, {
  Browsers,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  proto,
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

function serializeAuth(value: any) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserializeAuth(value: any) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver);
}

async function readStoredAuth(companyId: string) {
  const config = await prisma.channelConfig.findUnique({ where: { companyId_channel: { companyId, channel: "WHATSAPP" } } });
  const credentials = config?.credentials as any;
  return credentials?.auth ? deserializeAuth(credentials.auth) : { creds: initAuthCreds(), keys: {} };
}

async function writeStoredAuth(companyId: string, auth: any, externalAccountId?: string | null) {
  await prisma.channelConfig.upsert({
    where: { companyId_channel: { companyId, channel: "WHATSAPP" } },
    update: {
      externalAccountId: externalAccountId ?? undefined,
      credentials: { mode: "QR", auth: serializeAuth(auth) },
      isActive: true,
    },
    create: {
      companyId,
      channel: "WHATSAPP",
      externalAccountId: externalAccountId ?? null,
      credentials: { mode: "QR", auth: serializeAuth(auth) },
    },
  });
}

async function usePrismaAuthState(companyId: string) {
  const auth = await readStoredAuth(companyId);
  const saveCreds = () => writeStoredAuth(companyId, auth);

  return {
    state: {
      creds: auth.creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          for (const id of ids) {
            let value = auth.keys?.[type]?.[id];
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          auth.keys ||= {};
          for (const category of Object.keys(data)) {
            auth.keys[category] ||= {};
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              if (value) auth.keys[category][id] = value;
              else delete auth.keys[category][id];
            }
          }
          await writeStoredAuth(companyId, auth);
        },
      },
    },
    saveCreds,
    auth,
  };
}

function unwrapMessage(message: any): any {
  return (
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.documentWithCaptionMessage?.message ||
    message
  );
}

function getText(rawMessage: any) {
  const message = unwrapMessage(rawMessage);
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  );
}

async function processIncomingMessage(companyId: string, message: any) {
  if (!message.message || message.key.fromMe) return;
  const remoteJid = message.key.remoteJid as string | undefined;
  if (!remoteJid || remoteJid === "status@broadcast") return;

  const content = getText(message.message);
  if (!content.trim()) {
    logger.info({ companyId, remoteJid }, "Mensagem WhatsApp ignorada sem texto suportado");
    return;
  }

  const phone = remoteJid.split("@")[0];
  const contact =
    (await prisma.contact.findFirst({ where: { companyId, phone } })) ||
    (await prisma.contact.create({
      data: { companyId, phone, name: message.pushName || phone },
    }));

  let isNewConversation = false;
  let conversation = await prisma.conversation.findFirst({
    where: { companyId, channel: "WHATSAPP", externalId: remoteJid, status: { not: "RESOLVED" } },
    include: { assignedUser: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
  });

  if (!conversation) {
    isNewConversation = true;
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
  const payload = {
    id: conversation.id,
    status: conversation.status,
    contact,
    assignedUser: conversation.assignedUser,
    department: conversation.department,
    lastMessage: saved,
  };
  io.to(`company:${companyId}`).emit(isNewConversation ? "conversation:new" : "conversation:updated", {
    ...payload,
    conversationId: conversation.id,
  });
  io.to(`conversation:${conversation.id}`).emit("message:new", saved);
  logger.info({ companyId, conversationId: conversation.id, isNewConversation }, "Mensagem WhatsApp recebida");
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

  const { state, saveCreds, auth } = await usePrismaAuthState(companyId);
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
      await writeStoredAuth(companyId, auth, session.jid);
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

export async function restoreWhatsappQrSessions() {
  const configs = await prisma.channelConfig.findMany({
    where: { channel: "WHATSAPP", isActive: true },
    select: { companyId: true, credentials: true },
  });
  for (const config of configs) {
    const credentials = config.credentials as any;
    if (credentials?.mode === "QR" && credentials?.auth?.creds?.registered) {
      startWhatsappQrSession(config.companyId).catch((err) =>
        logger.error({ err, companyId: config.companyId }, "Erro ao restaurar WhatsApp QR")
      );
    }
  }
}
