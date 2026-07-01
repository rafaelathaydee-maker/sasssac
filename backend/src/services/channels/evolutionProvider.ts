import { Request, Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { ingestWhatsappTextMessage } from "./whatsappQr";

function enabled() {
  return Boolean(env.evolutionApiUrl && env.evolutionApiKey);
}

function baseUrl() {
  return env.evolutionApiUrl.replace(/\/$/, "");
}

function instanceName(companyId: string) {
  return `sasssac_${companyId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

async function evolutionFetch(path: string, init: RequestInit = {}) {
  if (!enabled()) {
    throw new Error("Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Render para usar WhatsApp por QR.");
  }
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: env.evolutionApiKey,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Evolution API falhou: ${response.status}`);
  }
  return data;
}

function normalizeQr(data: any) {
  const raw = data?.base64 || data?.qrcode?.base64 || data?.qrcode || data?.qr || data?.code;
  if (!raw) return null;
  if (typeof raw === "string" && raw.startsWith("data:image")) return raw;
  if (typeof raw === "string" && raw.length > 300) return `data:image/png;base64,${raw.replace(/^data:image\/png;base64,/, "")}`;
  return null;
}

async function ensureWebhook(companyId: string, instance: string) {
  if (!env.publicApiUrl) return;
  const webhookUrl = `${env.publicApiUrl.replace(/\/$/, "")}/api/webhooks/evolution/${companyId}`;
  await evolutionFetch(`/webhook/set/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    }),
  }).catch((err) => logger.warn({ err, companyId }, "Nao foi possivel configurar webhook Evolution"));
}

export function isEvolutionEnabled() {
  return enabled();
}

export async function startEvolutionWhatsapp(companyId: string) {
  const instance = instanceName(companyId);

  await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  }).catch((err) => logger.warn({ err, companyId }, "Instancia Evolution pode ja existir"));

  await ensureWebhook(companyId, instance);
  const qr = await evolutionFetch(`/instance/connect/${instance}`, { method: "GET" });
  const qrDataUrl = normalizeQr(qr);

  await prisma.channelConfig.upsert({
    where: { companyId_channel: { companyId, channel: "WHATSAPP" } },
    update: { externalAccountId: instance, credentials: { mode: "EVOLUTION", instance }, isActive: true },
    create: { companyId, channel: "WHATSAPP", externalAccountId: instance, credentials: { mode: "EVOLUTION", instance } },
  });

  return { status: qrDataUrl ? "qr" : "connecting", qrDataUrl, jid: instance, lastError: qrDataUrl ? null : "QR ainda nao foi retornado pela Evolution. Clique em Novo QR em alguns segundos." };
}

export async function getEvolutionWhatsappStatus(companyId: string) {
  const config = await prisma.channelConfig.findUnique({ where: { companyId_channel: { companyId, channel: "WHATSAPP" } } });
  const instance = (config?.credentials as any)?.instance || instanceName(companyId);
  try {
    const data = await evolutionFetch(`/instance/connectionState/${instance}`, { method: "GET" });
    const state = data?.instance?.state || data?.state || data?.connectionStatus;
    return { status: state === "open" ? "connected" : state || "idle", qrDataUrl: null, jid: instance, lastError: null };
  } catch (err: any) {
    return { status: "disconnected", qrDataUrl: null, jid: instance, lastError: err.message };
  }
}

export async function removeEvolutionWhatsapp(companyId: string) {
  const config = await prisma.channelConfig.findUnique({ where: { companyId_channel: { companyId, channel: "WHATSAPP" } } });
  const instance = (config?.credentials as any)?.instance || instanceName(companyId);
  await evolutionFetch(`/instance/delete/${instance}`, { method: "DELETE" }).catch(() => undefined);
}

export async function sendEvolutionWhatsappMessage(companyId: string, remoteJid: string, content: string) {
  const config = await prisma.channelConfig.findUnique({ where: { companyId_channel: { companyId, channel: "WHATSAPP" } } });
  const instance = (config?.credentials as any)?.instance || instanceName(companyId);
  const number = remoteJid.split("@")[0];
  return evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number, text: content }),
  });
}

function extractIncoming(body: any) {
  const data = body?.data || body;
  const message = data?.message || data?.messages?.[0]?.message || data?.messages?.[0] || {};
  const key = data?.key || data?.messages?.[0]?.key || {};
  const remoteJid = key?.remoteJid || data?.remoteJid || data?.from;
  const messageId = key?.id || data?.id;
  const pushName = data?.pushName || data?.notifyName;
  const content =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    data?.text ||
    data?.body;
  const fromMe = Boolean(key?.fromMe || data?.fromMe);
  return { remoteJid, messageId, pushName, content, fromMe };
}

export async function handleEvolutionWebhook(req: Request, res: Response) {
  const { companyId } = req.params;
  const event = req.body?.event || req.body?.type;
  if (event && !String(event).includes("MESSAGES")) return res.status(200).json({ ok: true });

  const incoming = extractIncoming(req.body);
  if (!incoming.remoteJid || incoming.fromMe || !incoming.content) return res.status(200).json({ ok: true });
  await ingestWhatsappTextMessage({
    companyId,
    remoteJid: incoming.remoteJid,
    content: incoming.content,
    pushName: incoming.pushName,
    messageId: incoming.messageId,
  });
  return res.status(200).json({ ok: true });
}
