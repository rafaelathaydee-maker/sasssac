import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { assertChannelAllowed } from "../../lib/planLimits";
import { logger } from "../../lib/logger";
import { logAudit } from "../../lib/audit";

function maskConfig(c: any) {
  return { channel: c.channel, externalAccountId: c.externalAccountId, isActive: c.isActive, updatedAt: c.updatedAt, configured: true };
}

// GET /api/channels -> quais canais essa empresa já configurou (sem expor segredos)
export async function listChannels(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const configs = await prisma.channelConfig.findMany({ where: { companyId } });
  return res.json(configs.map(maskConfig));
}

const whatsappConfigSchema = z.object({
  phoneNumberId: z.string().min(3),
  accessToken: z.string().min(10),
  wabaId: z.string().optional(),
  departmentId: z.string().nullable().optional(),
});

// PUT /api/channels/whatsapp -> admin configura (ou atualiza) o WhatsApp da empresa
export async function upsertWhatsapp(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { phoneNumberId, accessToken, wabaId, departmentId } = whatsappConfigSchema.parse(req.body);

  await assertChannelAllowed(companyId, "WHATSAPP");

  const config = await prisma.channelConfig.upsert({
    where: { companyId_channel: { companyId, channel: "WHATSAPP" } },
    update: { externalAccountId: phoneNumberId, credentials: { phoneNumberId, accessToken, wabaId }, isActive: true, departmentId },
    create: {
      companyId,
      channel: "WHATSAPP",
      externalAccountId: phoneNumberId,
      credentials: { phoneNumberId, accessToken, wabaId },
      departmentId,
    },
  });

  logger.info({ companyId }, "WhatsApp configurado");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "channel.whatsapp.connect", targetType: "channelConfig", targetId: config.id, metadata: { phoneNumberId } });
  return res.status(201).json(maskConfig(config));
}

// DELETE /api/channels/whatsapp -> remove a configuração
export async function removeWhatsapp(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  await prisma.channelConfig
    .delete({ where: { companyId_channel: { companyId, channel: "WHATSAPP" } } })
    .catch(() => null);
  return res.status(204).send();
}
