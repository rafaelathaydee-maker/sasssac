import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { AppError, NotFoundError } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

// GET /api/campaigns -> lista com contadores de progresso
export async function listCampaigns(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const campaigns = await prisma.campaign.findMany({
    where: { companyId },
    include: { _count: { select: { contacts: true } } },
    orderBy: { createdAt: "desc" },
  });

  const withSentCount = await Promise.all(
    campaigns.map(async (c: any) => {
      const sent = await prisma.campaignContact.count({ where: { campaignId: c.id, status: "SENT" } });
      const failed = await prisma.campaignContact.count({ where: { campaignId: c.id, status: "FAILED" } });
      return { ...c, total: c._count.contacts, sent, failed };
    })
  );
  return res.json(withSentCount);
}

// GET /api/campaigns/:id -> detalhe + status por contato (histórico)
export async function getCampaign(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, companyId },
    include: { contacts: { include: { contact: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!campaign) throw new NotFoundError("Campanha não encontrada");
  return res.json(campaign);
}

const createSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(["WHATSAPP", "WEBCHAT"]).default("WHATSAPP"),
  scheduledAt: z.string().datetime().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(120).optional(),
  tag: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
});

// POST /api/campaigns -> cria a campanha e já "tira a foto" da lista de contatos
export async function createCampaign(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const data = createSchema.parse(req.body);

  let contacts: { id: string }[] = [];
  if (data.contactIds?.length) {
    contacts = await prisma.contact.findMany({ where: { companyId, id: { in: data.contactIds } }, select: { id: true } });
  } else if (data.tag) {
    contacts = await prisma.contact.findMany({ where: { companyId, tags: { has: data.tag } }, select: { id: true } });
  }
  if (contacts.length === 0) throw new AppError("Nenhum contato encontrado pra essa lista (informe contactIds ou tag)", 400);

  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const status = scheduledAt && scheduledAt > new Date() ? "SCHEDULED" : "SENDING";

  const campaign = await prisma.campaign.create({
    data: {
      companyId,
      name: data.name,
      message: data.message,
      channel: data.channel,
      scheduledAt,
      status,
      rateLimitPerMinute: data.rateLimitPerMinute || 20,
      contacts: { create: contacts.map((c) => ({ contactId: c.id })) },
    },
  });

  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "campaign.create", targetType: "campaign", targetId: campaign.id, metadata: { totalContacts: contacts.length } });
  return res.status(201).json(campaign);
}

// POST /api/campaigns/:id/cancel -> cancela o que ainda não foi enviado
export async function cancelCampaign(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
  if (!campaign) throw new NotFoundError("Campanha não encontrada");
  if (campaign.status === "COMPLETED") throw new AppError("Campanha já foi concluída", 400);

  await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED" } });
  await prisma.campaignContact.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "FAILED", error: "Campanha cancelada" } });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "campaign.cancel", targetType: "campaign", targetId: id });
  return res.json({ id, status: "CANCELLED" });
}
