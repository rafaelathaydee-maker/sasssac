import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { getCompanyUsage } from "../../lib/planLimits";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { logAudit } from "../../lib/audit";

// GET /api/company -> dados + configurações da empresa logada
export async function getCompany(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const company = await prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } });
  if (!company) throw new AppError("Empresa não encontrada", 404);

  return res.json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    autoDistributionEnabled: company.autoDistributionEnabled,
    plan: { id: company.plan.id, name: company.plan.name, channels: company.plan.channels },
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    welcomeMessage: company.welcomeMessage,
    offlineMessage: company.offlineMessage,
  });
}

const updateSettingsSchema = z.object({
  autoDistributionEnabled: z.boolean().optional(),
});

// PATCH /api/company -> admin liga/desliga configurações (hoje: distribuição automática)
export async function updateCompany(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { autoDistributionEnabled } = updateSettingsSchema.parse(req.body);

  const company = await prisma.company.update({
    where: { id: companyId },
    data: { ...(typeof autoDistributionEnabled === "boolean" ? { autoDistributionEnabled } : {}) },
  });

  return res.json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    autoDistributionEnabled: company.autoDistributionEnabled,
  });
}

// GET /api/company/usage -> plano atual + uso (agentes, conversas do mês) pra UI mostrar barra de limite
export async function getUsage(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  return res.json(await getCompanyUsage(companyId));
}

const changePlanSchema = z.object({
  planId: z.enum(["FREE", "BASIC", "PRO"]),
});

// PATCH /api/company/plan -> admin troca de plano
// NOTA: isso só troca o "planId" no banco — não processa pagamento nenhum.
// Em produção real isso entraria depois de confirmar a cobrança (ex: webhook do Stripe).
export async function changePlan(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { planId } = changePlanSchema.parse(req.body);

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError("Plano inválido", 400);

  const company = await prisma.company.update({ where: { id: companyId }, data: { planId } });
  logger.info({ companyId, planId }, "Plano alterado");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "company.plan.change", targetType: "company", targetId: companyId, metadata: { planId } });

  return res.json({ id: company.id, planId: company.planId });
}

// GET /api/company/export -> admin exporta os próprios dados (LGPD/backup do cliente)
export async function exportOwnData(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const [company, contacts, conversations, messages] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId! } }),
    prisma.contact.findMany({ where: { companyId } }),
    prisma.conversation.findMany({ where: { companyId } }),
    prisma.message.findMany({ where: { conversation: { companyId } } }),
  ]);
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "company.export" });
  res.setHeader("Content-Disposition", `attachment; filename="${company?.slug}-export.json"`);
  return res.json({ exportedAt: new Date().toISOString(), company, contacts, conversations, messages });
}

const brandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  welcomeMessage: z.string().min(1).max(300).optional(),
  offlineMessage: z.string().min(1).max(300).optional(),
  businessHours: z
    .object({
      timezone: z.string(),
      ranges: z.array(z.object({ day: z.number().min(0).max(6), start: z.string(), end: z.string() })),
    })
    .nullable()
    .optional(),
});

// PATCH /api/company/branding -> ADMIN personaliza o widget (white-label) da própria empresa
export async function updateBranding(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const data = brandingSchema.parse(req.body);

  const company = await prisma.company.update({ where: { id: companyId! }, data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "company.branding.update", metadata: data });

  return res.json({
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    welcomeMessage: company.welcomeMessage,
    offlineMessage: company.offlineMessage,
    businessHours: company.businessHours,
  });
}

// GET /api/company/audit-logs -> "quem fez o quê" só da própria empresa (dono/admin)
export async function getOwnAuditLogs(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const logs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json(logs);
}
